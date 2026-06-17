"use strict";
"require baseclass";
"require form";
"require fs";
"require uci";
"require ui";

const USER_AGENTS = [
  ["auto", "Auto detect", "Автоопределение"],
  ["Happ/1.0", "Happ", "Happ"],
  ["HiddifyNext/2.5.7", "Hiddify Next", "Hiddify Next"],
  ["v2rayN/7.0", "v2rayN", "v2rayN"],
  ["v2rayNG/1.9.31", "v2rayNG", "v2rayNG"],
  ["NekoBox/1.3", "NekoBox", "NekoBox"],
  [
    "ClashMetaForAndroid/2.11.10",
    "Clash Meta for Android",
    "Clash Meta for Android",
  ],
  ["sing-box/1.12.0", "sing-box", "sing-box"],
  ["Shadowrocket/2.2.53", "Shadowrocket", "Shadowrocket"],
  ["curl/8.0", "curl", "curl"],
];

function isRussianLanguage() {
  let lang =
    typeof L !== "undefined" && L.env && L.env.lang
      ? String(L.env.lang).toLowerCase()
      : "";

  if (
    !lang &&
    typeof document !== "undefined" &&
    document.documentElement &&
    document.documentElement.lang
  ) {
    lang = String(document.documentElement.lang).toLowerCase();
  }

  return lang === "ru" || lang.startsWith("ru_") || lang.startsWith("ru-");
}

function i18n(en, ru) {
  return isRussianLanguage() ? ru : _(en);
}

function option(value, label) {
  return E("option", { value }, [label]);
}

function getPodkopSections() {
  try {
    return uci.sections("podkop", "section") || [];
  } catch (e) {
    return [];
  }
}

function renderSectionSelect() {
  const sections = getPodkopSections();

  return E(
    "select",
    { class: "cbi-input-select", id: "podkop-sub-section" },
    sections.map((section) => {
      const name = section[".name"];
      const label = section.name || name;
      return option(name, label);
    }),
  );
}

function renderUaSelect() {
  return E(
    "select",
    { class: "cbi-input-select", id: "podkop-sub-ua" },
    USER_AGENTS.map(([value, en, ru]) => option(value, i18n(en, ru))),
  );
}

function setStatus(node, message, className) {
  node.textContent = message || "";
  node.className = className || "";
}

function parseResponse(response) {
  if (!response || !response.stdout) {
    return {
      success: false,
      error: i18n("Empty command response", "Пустой ответ команды"),
    };
  }

  try {
    return JSON.parse(response.stdout);
  } catch (e) {
    return {
      success: false,
      error: response.stdout || response.stderr || String(e),
    };
  }
}

function renderServers(container, statusNode, sectionSelect, servers) {
  if (!servers || servers.length === 0) {
    container.replaceChildren(
      E("em", {}, [i18n("No servers found", "Серверы не найдены")]),
    );
    return;
  }

  const rows = servers.map((server) =>
    E("tr", {}, [
      E("td", {}, [String(server.index || "")]),
      E("td", {}, [server.name || ""]),
      E("td", {}, [server.scheme || ""]),
      E("td", {}, [server.host || ""]),
      E("td", {}, [server.port || ""]),
      E("td", {}, [
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-action",
            type: "button",
            click: (ev) => checkPing(statusNode, ev.currentTarget, server),
          },
          [i18n("Check", "Проверить")],
        ),
      ]),
      E("td", {}, [
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-apply",
            type: "button",
            click: () => applyServer(statusNode, sectionSelect, server),
          },
          [i18n("Use", "Выбрать")],
        ),
      ]),
    ]),
  );

  container.replaceChildren(
    E("table", { class: "table cbi-section-table" }, [
      E("tr", { class: "tr table-titles" }, [
        E("th", {}, ["#"]),
        E("th", {}, [i18n("Name", "Название")]),
        E("th", {}, [i18n("Type", "Тип")]),
        E("th", {}, [i18n("Host", "Хост")]),
        E("th", {}, [i18n("Port", "Порт")]),
        E("th", {}, [i18n("Ping", "Пинг")]),
        E("th", {}, [""]),
      ]),
      ...rows,
    ]),
  );
}

function checkPing(statusNode, button, server) {
  const oldText = button.textContent;

  button.disabled = true;
  button.textContent = i18n("Checking...", "Проверка...");

  fs.exec("/usr/bin/podkop-subscriptions", ["ping", server.link])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "ping failed");
      }

      button.textContent = `${payload.latency_ms} ms`;
      setStatus(
        statusNode,
        i18n("Ping check completed", "Проверка пинга выполнена"),
        "alert-message success",
      );
    })
    .catch((error) => {
      button.textContent = oldText;
      setStatus(statusNode, String(error.message || error), "alert-message warning");
    })
    .finally(() => {
      button.disabled = false;
    });
}

function applyServer(statusNode, sectionSelect, server) {
  const section = sectionSelect.value;

  if (!section) {
    setStatus(
      statusNode,
      i18n("Select a Podkop section", "Выберите секцию Podkop"),
      "alert-message warning",
    );
    return;
  }

  setStatus(statusNode, i18n("Saving...", "Сохранение..."), "");

  fs.exec("/usr/bin/podkop-subscriptions", ["apply", section, server.link])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "apply failed");
      }

      setStatus(
        statusNode,
        i18n(
          "Server saved to Podkop section. Restart Podkop to use it.",
          "Сервер сохранен в секцию Podkop. Перезапустите Podkop, чтобы применить его.",
        ),
        "alert-message success",
      );
      ui.addNotification(
        null,
        E("p", {}, [
          i18n(
            "Subscription server saved. Restart Podkop.",
            "Сервер из подписки сохранен. Перезапустите Podkop.",
          ),
        ]),
        "info",
      );
    })
    .catch((error) => {
      setStatus(statusNode, String(error.message || error), "alert-message error");
    });
}

function loadServers(statusNode, resultNode, sectionSelect, urlInput, uaSelect, limitInput) {
  const url = urlInput.value.trim();
  const userAgent = uaSelect.value || "auto";
  const limit = limitInput.value || "100";

  if (!url) {
    setStatus(
      statusNode,
      i18n("Subscription URL is required", "Укажите URL подписки"),
      "alert-message warning",
    );
    return;
  }

  setStatus(statusNode, i18n("Loading...", "Загрузка..."), "");
  resultNode.replaceChildren();

  fs.exec("/usr/bin/podkop-subscriptions", ["list", url, userAgent, limit])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "load failed");
      }

      setStatus(
        statusNode,
        i18n("Servers loaded", "Серверы загружены"),
        "alert-message success",
      );
      renderServers(resultNode, statusNode, sectionSelect, payload.servers);
    })
    .catch((error) => {
      setStatus(statusNode, String(error.message || error), "alert-message error");
    });
}

function renderImporter() {
  const statusNode = E("div", { style: "margin: 8px 0;" });
  const resultNode = E("div", { style: "margin-top: 12px;" });
  const sectionSelect = renderSectionSelect();
  const urlInput = E("input", {
    class: "cbi-input-text",
    id: "podkop-sub-url",
    type: "text",
    placeholder: "https://example.com/subscription",
    style: "width: 100%;",
  });
  const uaSelect = renderUaSelect();
  const limitInput = E("input", {
    class: "cbi-input-text",
    id: "podkop-sub-limit",
    type: "number",
    min: "1",
    max: "500",
    value: "100",
  });

  return E("div", { class: "cbi-section" }, [
    E("div", { class: "cbi-value" }, [
      E("label", { class: "cbi-value-title", for: "podkop-sub-section" }, [
        i18n("Podkop Section", "Секция Podkop"),
      ]),
      E("div", { class: "cbi-value-field" }, [sectionSelect]),
    ]),
    E("div", { class: "cbi-value" }, [
      E("label", { class: "cbi-value-title", for: "podkop-sub-url" }, [
        i18n("Subscription URL", "URL подписки"),
      ]),
      E("div", { class: "cbi-value-field" }, [urlInput]),
    ]),
    E("div", { class: "cbi-value" }, [
      E("label", { class: "cbi-value-title", for: "podkop-sub-ua" }, [
        i18n("User-Agent", "User-Agent"),
      ]),
      E("div", { class: "cbi-value-field" }, [uaSelect]),
    ]),
    E("div", { class: "cbi-value" }, [
      E("label", { class: "cbi-value-title", for: "podkop-sub-limit" }, [
        i18n("Limit", "Лимит"),
      ]),
      E("div", { class: "cbi-value-field" }, [limitInput]),
    ]),
    E("div", { class: "cbi-value" }, [
      E("div", { class: "cbi-value-title" }),
      E("div", { class: "cbi-value-field" }, [
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-action",
            type: "button",
            click: () =>
              loadServers(
                statusNode,
                resultNode,
                sectionSelect,
                urlInput,
                uaSelect,
                limitInput,
              ),
          },
          [i18n("Load Servers", "Загрузить серверы")],
        ),
      ]),
    ]),
    statusNode,
    resultNode,
  ]);
}

function createSubscriptionsContent(section) {
  const o = section.option(form.DummyValue, "_podkop_subscriptions");
  o.rawhtml = true;
  o.cfgvalue = () => renderImporter();
}

const EntryPoint = {
  createSubscriptionsContent,
};

return baseclass.extend(EntryPoint);
