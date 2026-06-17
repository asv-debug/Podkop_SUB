"use strict";
"require baseclass";
"require form";
"require ui";
"require uci";
"require fs";
"require view.podkop.main as main";

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

function normalizeValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProxyLinkScheme(link) {
  return String(link || "").split("://")[0] || "";
}

function getProxyLinkHost(link) {
  const value = String(link || "");
  const withoutScheme = value.includes("://")
    ? value.slice(value.indexOf("://") + 3)
    : value;
  const withoutUser = withoutScheme.includes("@")
    ? withoutScheme.slice(withoutScheme.lastIndexOf("@") + 1)
    : withoutScheme;

  return withoutUser.split(/[/?#]/)[0] || "";
}

function getProxyLinkName(link) {
  const value = String(link || "");
  const hashIndex = value.indexOf("#");

  if (hashIndex >= 0 && hashIndex < value.length - 1) {
    try {
      return decodeURIComponent(value.slice(hashIndex + 1));
    } catch (e) {
      return value.slice(hashIndex + 1);
    }
  }

  return `${getProxyLinkScheme(value)}://${getProxyLinkHost(value)}`;
}

function getActiveSubscriptionLink(section) {
  const selected = section.subscription_selected_proxy_link;
  const selectorLinks = normalizeValues(section.selector_proxy_links);

  return selected || (selectorLinks.length === 1 ? selectorLinks[0] : "") || "";
}

function getSubscriptionSections() {
  return uci
    .sections("podkop")
    .filter((section) => section[".type"] !== "settings")
    .map((section) => ({
      id: section[".name"],
      displayName: section.name || section[".name"],
      links: normalizeValues(section.subscription_proxy_links),
      selectedLink: getActiveSubscriptionLink(section),
    }))
    .filter((section) => section.links.length > 0);
}

function getSubscriptionServerCard(sectionId, index) {
  return Array.from(
    document.querySelectorAll(".podkop-subscription-dashboard-card"),
  ).find(
    (card) =>
      card.getAttribute("data-section-id") === sectionId &&
      card.getAttribute("data-server-index") === String(index),
  );
}

function updateSubscriptionLatency(sectionId, index, latency, success) {
  const card = getSubscriptionServerCard(sectionId, index);
  if (!card) {
    return;
  }

  const node = card.querySelector(".podkop-subscription-dashboard-latency");
  if (!node) {
    return;
  }

  node.classList.remove(
    "podkop-subscription-dashboard-latency-empty",
    "podkop-subscription-dashboard-latency-green",
    "podkop-subscription-dashboard-latency-yellow",
    "podkop-subscription-dashboard-latency-red",
  );

  if (!success || !latency) {
    node.textContent = "N/A";
    node.classList.add("podkop-subscription-dashboard-latency-empty");
    return;
  }

  const value = Number(latency);
  node.textContent = `${latency}ms`;
  if (value < 800) {
    node.classList.add("podkop-subscription-dashboard-latency-green");
  } else if (value < 1500) {
    node.classList.add("podkop-subscription-dashboard-latency-yellow");
  } else {
    node.classList.add("podkop-subscription-dashboard-latency-red");
  }
}

function pingSubscriptionServers(sectionId, links, button) {
  const oldText = button ? button.textContent : "";

  if (!links.length) {
    return Promise.resolve();
  }

  if (button) {
    button.disabled = true;
    button.textContent = i18n("Pinging...", "Пинг...");
  }

  return fs
    .exec("/usr/bin/podkop-subscriptions", ["ping-list", links.join("\n")])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "ping failed");
      }

      (payload.results || []).forEach((result) => {
        updateSubscriptionLatency(
          sectionId,
          result.index,
          result.latency_ms,
          result.success,
        );
      });
    })
    .catch((error) => {
      ui.addNotification(
        null,
        E("p", {}, [String(error.message || error)]),
        "danger",
      );
    })
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    });
}

function applySubscriptionServer(sectionId, link, card) {
  if (card) {
    card.classList.add("podkop-subscription-dashboard-card-loading");
  }

  return fs
    .exec("/usr/bin/podkop-subscriptions", ["apply", sectionId, link])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "apply failed");
      }

      ui.addNotification(
        null,
        E("p", {}, [
          i18n("Server selected and applied.", "Сервер выбран и применён."),
        ]),
        "info",
      );

      window.setTimeout(() => window.location.reload(), 1000);
    })
    .catch((error) => {
      if (card) {
        card.classList.remove("podkop-subscription-dashboard-card-loading");
      }
      ui.addNotification(
        null,
        E("p", {}, [String(error.message || error)]),
        "danger",
      );
    });
}

function renderSubscriptionStyles() {
  return E("style", {}, [
    ".podkop-subscription-dashboard{display:flex;flex-direction:column;gap:12px;margin-top:12px}",
    ".podkop-subscription-dashboard .pdk_dashboard-page__outbound-grid__item{min-height:72px}",
    ".podkop-subscription-dashboard-card{cursor:pointer}",
    ".podkop-subscription-dashboard-card-loading{opacity:.65;pointer-events:none}",
    ".podkop-subscription-dashboard-card-name{overflow-wrap:anywhere}",
    ".podkop-subscription-dashboard-latency-empty{color:#777}",
    ".podkop-subscription-dashboard-latency-green{color:#4caf50}",
    ".podkop-subscription-dashboard-latency-yellow{color:#ff9800}",
    ".podkop-subscription-dashboard-latency-red{color:#f44336}",
  ].join("\n"));
}

function renderSubscriptionCard(section, link, index) {
  const active = link === section.selectedLink;

  return E(
    "div",
    {
      class: `pdk_dashboard-page__outbound-grid__item pdk_dashboard-page__outbound-grid__item--selectable podkop-subscription-dashboard-card ${active ? "pdk_dashboard-page__outbound-grid__item--active" : ""}`,
      "data-section-id": section.id,
      "data-server-index": String(index + 1),
      click: (ev) => applySubscriptionServer(section.id, link, ev.currentTarget),
    },
    [
      E("b", { class: "podkop-subscription-dashboard-card-name" }, [
        getProxyLinkName(link),
      ]),
      E("div", { class: "pdk_dashboard-page__outbound-grid__item__footer" }, [
        E("div", { class: "pdk_dashboard-page__outbound-grid__item__type" }, [
          getProxyLinkScheme(link).toUpperCase(),
        ]),
        E(
          "div",
          {
            class:
              "podkop-subscription-dashboard-latency podkop-subscription-dashboard-latency-empty",
          },
          ["N/A"],
        ),
      ]),
    ],
  );
}

function renderSubscriptionSection(section) {
  return E("div", { class: "pdk_dashboard-page__outbound-section" }, [
    E("div", { class: "pdk_dashboard-page__outbound-section__title-section" }, [
      E(
        "div",
        {
          class: "pdk_dashboard-page__outbound-section__title-section__title",
        },
        `${i18n("Subscription", "Подписка")}: ${section.displayName}`,
      ),
      E(
        "button",
        {
          class: "btn dashboard-sections-grid-item-test-latency",
          type: "button",
          click: (ev) =>
            pingSubscriptionServers(section.id, section.links, ev.currentTarget),
        },
        i18n("Ping all", "Пинг всех"),
      ),
    ]),
    E(
      "div",
      { class: "pdk_dashboard-page__outbound-grid" },
      section.links.map((link, index) => renderSubscriptionCard(section, link, index)),
    ),
  ]);
}

function renderSubscriptionDashboard() {
  const sections = getSubscriptionSections();

  if (!sections.length) {
    return "";
  }

  return E("div", { class: "podkop-subscription-dashboard" }, [
    renderSubscriptionStyles(),
    ...sections.map((section) => renderSubscriptionSection(section)),
  ]);
}

function createDashboardContent(section) {
  let o = section.option(form.DummyValue, "_mount_node");
  o.rawhtml = true;
  o.cfgvalue = () => {
    main.DashboardTab.initController();
    return main.DashboardTab.render();
  };

  o = section.option(form.DummyValue, "_subscription_mount_node");
  o.rawhtml = true;
  o.cfgvalue = () => renderSubscriptionDashboard();
}

const EntryPoint = {
  createDashboardContent,
};

return baseclass.extend(EntryPoint);
