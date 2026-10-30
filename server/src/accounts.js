/* Eldoria – accounts: a username and password attached to the hero token. One Durable Object ("main") holds every
   account. The token stays the key of the heroes; an account links a name and password to it, so you can log in on
   another device and get the token back. Passwords: salted PBKDF2-SHA256. There is no e-mail, so registering shows a
   one-time recovery code that lets you set a new password.
   HTTP, JSON:  POST /account/register {name, password, token}  → {ok, name, token, recoveryCode}
                POST /account/login    {name, password}         → {ok, name, token}
                POST /account/recover  {name, code, password}   → {ok, name, token, recoveryCode}
                POST /account/whoami   {token}                  → {ok, name|null}
                POST /account/delete   {name, password}         → {ok, name, token}   (the heroes stay with the token)
   Failures answer {ok: false, error}. */
import { DurableObject } from "cloudflare:workers";
import { isValidToken } from "./hero-store.js";

const PBKDF2_ITERATIONS = 60000;
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ACCOUNT_PREFIX = "acc:";
const TOKEN_PREFIX = "tok:";

const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in ten minutes.";
const WRONG_PASSWORD = "Unknown username or wrong password.";
const WEAK_PASSWORD = "A password has at least 6 characters.";

const encoder = new TextEncoder();

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
const randomHex = (byteCount) => toHex(crypto.getRandomValues(new Uint8Array(byteCount)));

async function hashSecret(secret, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((pair) => parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

/* constant-time comparison, so the time taken does not reveal how much of a hash matched */
function isEqualConstantTime(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

const isValidAccountName = (name) => typeof name === "string" && /^[A-Za-z0-9_]{3,16}$/.test(name);
const isValidPassword = (password) =>
  typeof password === "string" && password.length >= 6 && password.length <= 72;

/* a readable recovery code: 4 groups of 4 */
const createRecoveryCode = () => randomHex(8).toUpperCase().match(/.{4}/g).join("-");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/* accounts from before the English refactor store `naam` instead of `name` */
const accountName = (account) => account.name ?? account.naam;

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /* account key → {count, since}: failed attempts in the current window */
    this.attempts = new Map();
  }

  #isLockedOut(key) {
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return false;
    }
    if (Date.now() - attempt.since > ATTEMPT_WINDOW_MS) {
      this.attempts.delete(key);
      return false;
    }
    return attempt.count >= MAX_ATTEMPTS;
  }

  #recordFailure(key) {
    const attempt = this.attempts.get(key);
    if (attempt && Date.now() - attempt.since <= ATTEMPT_WINDOW_MS) {
      attempt.count++;
    } else {
      this.attempts.set(key, { count: 1, since: Date.now() });
    }
  }

  async #isPasswordCorrect(account, password) {
    return (
      Boolean(account) &&
      isValidPassword(password) &&
      isEqualConstantTime(await hashSecret(password, account.salt), account.hash)
    );
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "POST expected" }, 405);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "no JSON" }, 400);
    }
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "no JSON" }, 400);
    }
    const route = new URL(request.url).pathname.replace(/^\/account\//, "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const key = ACCOUNT_PREFIX + name.toLowerCase();

    if (route === "whoami") {
      return this.#whoami(body);
    }
    if (!isValidAccountName(name)) {
      return json({ ok: false, error: "A username has 3 to 16 letters, digits or underscores." });
    }
    if (route === "register") {
      return this.#register(body, name, key);
    }
    if (route === "login") {
      return this.#login(body, key);
    }
    if (route === "recover") {
      return this.#recover(body, key);
    }
    if (route === "delete") {
      return this.#deleteAccount(body, key);
    }
    return json({ ok: false, error: "unknown" }, 404);
  }

  async #whoami(body) {
    if (!isValidToken(body.token)) {
      return json({ ok: true, name: null });
    }
    const name = await this.ctx.storage.get(TOKEN_PREFIX + body.token);
    return json({ ok: true, name: name || null });
  }

  async #register(body, name, key) {
    if (!isValidPassword(body.password)) {
      return json({ ok: false, error: WEAK_PASSWORD });
    }
    if (!isValidToken(body.token)) {
      return json({ ok: false, error: "No hero token." });
    }
    if (await this.ctx.storage.get(key)) {
      return json({ ok: false, error: "That username is taken." });
    }
    if (await this.ctx.storage.get(TOKEN_PREFIX + body.token)) {
      return json({
        ok: false,
        error: "These heroes already belong to an account. Log out first.",
      });
    }
    const salt = randomHex(16);
    const recoveryCode = createRecoveryCode();
    const codeSalt = randomHex(16);
    const account = {
      name,
      salt,
      hash: await hashSecret(body.password, salt),
      token: body.token,
      codeSalt,
      codeHash: await hashSecret(recoveryCode, codeSalt),
      created: Date.now(),
    };
    await this.ctx.storage.put(key, account);
    await this.ctx.storage.put(TOKEN_PREFIX + body.token, name);
    return json({ ok: true, name, token: body.token, recoveryCode });
  }

  async #login(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    if (!(await this.#isPasswordCorrect(account, body.password))) {
      this.#recordFailure(key);
      return json({ ok: false, error: WRONG_PASSWORD });
    }
    this.attempts.delete(key);
    return json({ ok: true, name: accountName(account), token: account.token });
  }

  /* a new password with the recovery code; the code is replaced by a fresh one */
  async #recover(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (
      !account ||
      !code ||
      !isEqualConstantTime(await hashSecret(code, account.codeSalt), account.codeHash)
    ) {
      this.#recordFailure(key);
      return json({ ok: false, error: "Unknown username or wrong recovery code." });
    }
    if (!isValidPassword(body.password)) {
      return json({ ok: false, error: WEAK_PASSWORD });
    }
    const recoveryCode = createRecoveryCode();
    account.salt = randomHex(16);
    account.hash = await hashSecret(body.password, account.salt);
    account.codeSalt = randomHex(16);
    account.codeHash = await hashSecret(recoveryCode, account.codeSalt);
    await this.ctx.storage.put(key, account);
    this.attempts.delete(key);
    return json({ ok: true, name: accountName(account), token: account.token, recoveryCode });
  }

  /* removes the account; the heroes stay with the token, which is then free for a new account */
  async #deleteAccount(body, key) {
    if (this.#isLockedOut(key)) {
      return json({ ok: false, error: TOO_MANY_ATTEMPTS });
    }
    const account = await this.ctx.storage.get(key);
    if (!(await this.#isPasswordCorrect(account, body.password))) {
      this.#recordFailure(key);
      return json({ ok: false, error: WRONG_PASSWORD });
    }
    await this.ctx.storage.delete(key);
    await this.ctx.storage.delete(TOKEN_PREFIX + account.token);
    return json({ ok: true, name: accountName(account), token: account.token });
  }
}
