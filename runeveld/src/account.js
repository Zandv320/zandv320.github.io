/* Eldoria – accounts on the character select screen: log in, register and recover with the server
   (server/src/accounts.js). An account ties a name and password to the hero token of this browser; logging in on
   another device fetches that token, after which the heroes show up there too. Without an account you play as a
   guest on a token. */
import { SERVER_URL, accountToken, setAccountToken } from "./network.js";

const $ = (selector) => document.querySelector(selector);

const ACCOUNT_KEY = "eldoria.account";
const HEROES_KEY = "eldoria.heroes";
const TOKEN_KEY = "eldoria.token";
const SERVER_KEY = "eldoria.server";

/* Texts per form mode: login, register or recover. */
const SUBMIT_LABELS = {
  login: "Log in",
  register: "Create account",
  recover: "Set new password",
};
const HINTS = {
  login: "Log in to play with the heroes of your account on this device.",
  register:
    "Your current heroes become the heroes of this account. You get a recovery code: keep it safe, there is no e-mail reset.",
  recover: "Lost your password? Enter your recovery code to set a new one.",
};

/** Name of the logged-in account, or '' for a guest. */
export const accountName = () => {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || "";
  } catch (e) {
    return "";
  }
};

/**
 * Wires up the account screen and the account line on the character select screen.
 * @param {{showScreen: (name: string) => void, reload: () => void}} deps
 * @returns {{refreshStatus: () => void}}
 */
export function createAccountPanel({ showScreen, reload }) {
  let mode = "login";

  // The server address can be overridden in localStorage for local testing (empty = no server).
  const serverUrl = () => {
    let url = SERVER_URL;
    try {
      const override = localStorage.getItem(SERVER_KEY);
      if (override !== null) url = override;
    } catch (e) {}
    return url.replace(/\/$/, "");
  };

  async function post(route, body) {
    const url = serverUrl();
    if (!url) {
      return { ok: false, error: "No server configured." };
    }
    try {
      const response = await fetch(url + "/account/" + route, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (e) {
      return { ok: false, error: "The server did not answer. Try again in a moment." };
    }
  }

  function refreshStatus() {
    const name = accountName();
    $("#account-status").innerHTML = name
      ? `Logged in as <b>${name.replace(/[<>&]/g, "")}</b>`
      : "Guest account · heroes live in this browser only";
    $("#account-button").textContent = name ? "Log out" : "Log in";
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll(".account-tabs .tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.accountTab === newMode);
    });
    $("#account-code-row").hidden = newMode !== "recover";
    $("#account-password-label").textContent = newMode === "login" ? "Password" : "New password";
    $("#account-password").autocomplete = newMode === "login" ? "current-password" : "new-password";
    $("#account-submit").textContent = SUBMIT_LABELS[newMode];
    $("#account-hint").textContent = HINTS[newMode];
    $("#account-error").textContent = "";
    $("#account-form").hidden = false;
    $("#account-done").hidden = true;
  }

  function open() {
    setMode("login");
    $("#account-name").value = "";
    $("#account-password").value = "";
    $("#account-code").value = "";
    showScreen("account");
    $("#account-name").focus();
  }

  document.querySelectorAll(".account-tabs .tab").forEach((button) => {
    button.onclick = () => setMode(button.dataset.accountTab);
  });
  $("#account-back").onclick = () => showScreen("select");

  $("#account-button").onclick = () => {
    if (!accountName()) {
      open();
      return;
    }
    if (
      !confirm(
        "Log out? This browser goes back to a guest account without heroes until you log in again.",
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem(ACCOUNT_KEY);
      localStorage.removeItem(HEROES_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    // Creates a fresh guest token right away.
    accountToken();
    reload();
  };

  let isBusy = false;
  let result = null;

  $("#account-form").onsubmit = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    isBusy = true;
    $("#account-submit").disabled = true;
    $("#account-error").textContent = "";

    const name = $("#account-name").value.trim();
    const password = $("#account-password").value;
    let response;
    if (mode === "login") {
      response = await post("login", { name, password });
    } else if (mode === "register") {
      response = await post("register", { name, password, token: accountToken() });
    } else {
      response = await post("recover", { name, password, code: $("#account-code").value });
    }

    isBusy = false;
    $("#account-submit").disabled = false;
    if (!response || !response.ok) {
      $("#account-error").textContent = (response && response.error) || "Something went wrong.";
      return;
    }
    result = response;
    // Register and recover hand out a (new) recovery code, which is shown once before continuing.
    if (response.recoveryCode) {
      $("#account-form").hidden = true;
      $("#account-done").hidden = false;
      $("#account-done-text").textContent =
        mode === "register"
          ? `Welcome, ${response.name}! Your account is ready.`
          : `Password changed for ${response.name}.`;
      $("#account-recovery-code").textContent = response.recoveryCode;
    } else {
      finish();
    }
  };
  $("#account-continue").onclick = finish;

  /* Takes over the account's token; the local copy of the heroes is dropped (the server has them). */
  function finish() {
    const response = result;
    if (!response) return;
    try {
      localStorage.setItem(ACCOUNT_KEY, response.name);
      if (response.token && response.token !== accountToken()) {
        localStorage.removeItem(HEROES_KEY);
        setAccountToken(response.token);
      }
    } catch (e) {}
    reload();
  }

  refreshStatus();
  return { refreshStatus };
}
