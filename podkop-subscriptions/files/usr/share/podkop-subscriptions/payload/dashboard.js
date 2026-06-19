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

function getSubscriptionNameFromUrl(url) {
  const value = String(url || "").trim();

  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/$/, "");
    const query = parsed.search && !pathname ? parsed.search : "";
    return `${parsed.hostname}${pathname}${query}`;
  } catch (e) {
    return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/$/, "");
  }
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
      subscriptionUrls: normalizeValues(
        section.subscription_urls || section.subscription_url,
      ),
      links: normalizeValues(section.subscription_proxy_links),
      selectedLink: getActiveSubscriptionLink(section),
    }))
    .filter((section) => section.links.length > 0);
}

function getSubscriptionTitle(section) {
  const subscriptionName =
    getSubscriptionNameFromUrl(section.subscriptionUrls[0]) ||
    i18n("Subscription", "Подписка");
  const suffix =
    section.subscriptionUrls.length > 1 ? ` +${section.subscriptionUrls.length - 1}` : "";

  return `${subscriptionName}${suffix} · ${section.displayName}`;
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

function getLatencyLoadingTimers() {
  if (typeof window === "undefined") {
    return {};
  }

  window.__podkopSubscriptionLatencyTimers =
    window.__podkopSubscriptionLatencyTimers || {};

  return window.__podkopSubscriptionLatencyTimers;
}

function stopSubscriptionLatencyLoading(sectionId, index) {
  const key = `${sectionId}:${index}`;
  const timers = getLatencyLoadingTimers();

  if (timers[key]) {
    window.clearInterval(timers[key]);
    delete timers[key];
  }

  const card = getSubscriptionServerCard(sectionId, index);
  const node = card
    ? card.querySelector(".podkop-subscription-dashboard-latency")
    : null;

  if (node) {
    node.classList.remove("podkop-subscription-dashboard-latency-loading");
  }
}

function startSubscriptionLatencyLoading(sectionId, index) {
  const card = getSubscriptionServerCard(sectionId, index);
  const node = card
    ? card.querySelector(".podkop-subscription-dashboard-latency")
    : null;

  if (!node || typeof window === "undefined") {
    return;
  }

  stopSubscriptionLatencyLoading(sectionId, index);
  node.classList.remove(
    "podkop-subscription-dashboard-latency-empty",
    "podkop-subscription-dashboard-latency-green",
    "podkop-subscription-dashboard-latency-yellow",
    "podkop-subscription-dashboard-latency-red",
  );
  node.classList.add("podkop-subscription-dashboard-latency-loading");

  const frames = [".", "..", "..."];
  let frame = 0;
  const tick = () => {
    node.textContent = frames[frame % frames.length];
    frame += 1;
  };

  tick();
  getLatencyLoadingTimers()[`${sectionId}:${index}`] = window.setInterval(
    tick,
    350,
  );
}

function startSubscriptionLatenciesLoading(sectionId, count) {
  for (let index = 1; index <= count; index += 1) {
    startSubscriptionLatencyLoading(sectionId, index);
  }
}

function clearSubscriptionLatenciesLoading(sectionId, count) {
  for (let index = 1; index <= count; index += 1) {
    stopSubscriptionLatencyLoading(sectionId, index);
  }
}

function startButtonLoading(button) {
  if (!button || typeof window === "undefined") {
    return () => {};
  }

  const oldText = button.textContent;
  const baseText = i18n("Pinging", "Пинг");
  const frames = [".", "..", "..."];
  let frame = 0;

  button.disabled = true;
  const tick = () => {
    button.textContent = `${baseText}${frames[frame % frames.length]}`;
    frame += 1;
  };
  tick();

  const timer = window.setInterval(tick, 350);
  return () => {
    window.clearInterval(timer);
    button.disabled = false;
    button.textContent = oldText;
  };
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

  stopSubscriptionLatencyLoading(sectionId, index);
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

function pingSubscriptionServers(sectionId, links, button, options) {
  if (!links.length) {
    return Promise.resolve();
  }

  const opts = options || {};
  const stopButtonLoading = startButtonLoading(button);
  let successCount = 0;
  let failedCount = 0;
  let queue = Promise.resolve();

  startSubscriptionLatenciesLoading(sectionId, links.length);

  links.forEach((link, index) => {
    const serverIndex = index + 1;

    queue = queue.then(() =>
      fs
        .exec("/usr/bin/podkop-subscriptions", ["ping", link])
        .then((response) => {
          const payload = parseResponse(response);

          if (payload.success && payload.latency_ms) {
            successCount += 1;
            updateSubscriptionLatency(
              sectionId,
              serverIndex,
              payload.latency_ms,
              true,
            );
            return;
          }

          failedCount += 1;
          updateSubscriptionLatency(sectionId, serverIndex, null, false);
        })
        .catch(() => {
          failedCount += 1;
          updateSubscriptionLatency(sectionId, serverIndex, null, false);
        }),
    );
  });

  return queue
    .then(() => {
      if (!successCount && failedCount && !opts.silent) {
        ui.addNotification(
          null,
          E("p", {}, [i18n("Ping failed for all servers.", "Пинг не удался для всех серверов.")]),
          "danger",
        );
      }
    })
    .catch((error) => {
      links.forEach((_, index) => {
        updateSubscriptionLatency(
          sectionId,
          index + 1,
          null,
          false,
        );
      });

      if (!opts.silent) {
        ui.addNotification(
          null,
          E("p", {}, [String(error.message || error)]),
          "danger",
        );
      }
    })
    .finally(() => {
      clearSubscriptionLatenciesLoading(sectionId, links.length);
      stopButtonLoading();
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
    "#cbi-podkop-dashboard-_subscription_mount_node{width:100%}",
    "#cbi-podkop-dashboard-_subscription_mount_node>div{width:100%}",
    ".podkop-subscription-dashboard{display:flex;flex-direction:column;gap:12px;margin-top:12px;width:100%;--dashboard-grid-columns:4}",
    "@media (max-width:900px){.podkop-subscription-dashboard{--dashboard-grid-columns:2}}",
    "@media (max-width:520px){.podkop-subscription-dashboard{--dashboard-grid-columns:1}}",
    ".podkop-subscription-dashboard .pdk_dashboard-page__outbound-section{width:100%;box-sizing:border-box}",
    ".podkop-subscription-dashboard .pdk_dashboard-page__outbound-grid{grid-template-columns:repeat(var(--dashboard-grid-columns),minmax(0,1fr));width:100%}",
    ".podkop-subscription-dashboard .pdk_dashboard-page__outbound-grid__item{min-height:112px;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:10px}",
    ".podkop-subscription-dashboard-card-loading{opacity:.65;pointer-events:none}",
    ".podkop-subscription-dashboard-card-name{overflow-wrap:anywhere}",
    ".podkop-subscription-dashboard-card-action{display:flex;align-items:center;justify-content:flex-end;margin-top:2px}",
    ".podkop-subscription-dashboard-card-action .btn{white-space:nowrap}",
    ".podkop-subscription-dashboard-latency-empty{color:#777}",
    ".podkop-subscription-dashboard-latency-green{color:#4caf50}",
    ".podkop-subscription-dashboard-latency-yellow{color:#ff9800}",
    ".podkop-subscription-dashboard-latency-red{color:#f44336}",
    ".podkop-subscription-dashboard-latency-loading{color:#56b4e9;letter-spacing:2px;min-width:24px;text-align:right}",
  ].join("\n"));
}

function renderSubscriptionCard(section, link, index) {
  const active = link === section.selectedLink;
  const buttonAttrs = {
    class: "btn cbi-button cbi-button-apply",
    type: "button",
    click: (ev) =>
      applySubscriptionServer(
        section.id,
        link,
        ev.currentTarget.closest(".podkop-subscription-dashboard-card"),
      ),
  };

  if (active) {
    buttonAttrs.disabled = "disabled";
  }

  return E(
    "div",
    {
      class: `pdk_dashboard-page__outbound-grid__item podkop-subscription-dashboard-card ${active ? "pdk_dashboard-page__outbound-grid__item--active" : ""}`,
      "data-section-id": section.id,
      "data-server-index": String(index + 1),
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
      E("div", { class: "podkop-subscription-dashboard-card-action" }, [
        E(
          "button",
          buttonAttrs,
          active
            ? i18n("Selected", "Выбран")
            : i18n("Select server", "Выбрать сервер"),
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
        getSubscriptionTitle(section),
      ),
      E(
        "button",
        {
          class: "btn dashboard-sections-grid-item-test-latency",
          type: "button",
          title: i18n(
            "Checks latency from the router",
            "Проверяет задержку с роутера",
          ),
          click: (ev) =>
            pingSubscriptionServers(section.id, section.links, ev.currentTarget),
        },
        i18n("Ping", "Пинг"),
      ),
    ]),
    E(
      "div",
      { class: "pdk_dashboard-page__outbound-grid" },
      section.links.map((link, index) => renderSubscriptionCard(section, link, index)),
    ),
  ]);
}

function scheduleSubscriptionAutoPing(sections) {
  if (typeof window === "undefined") {
    return;
  }

  const key = sections
    .map((section) => `${section.id}:${section.links.length}:${section.selectedLink}`)
    .join("|");

  if (window.__podkopSubscriptionAutoPingKey === key) {
    return;
  }

  window.__podkopSubscriptionAutoPingKey = key;
  window.setTimeout(() => {
    let queue = Promise.resolve();

    sections.forEach((section) => {
      queue = queue.then(() =>
        pingSubscriptionServers(section.id, section.links, null, {
          silent: true,
        }),
      );
    });
  }, 250);
}

function renderSubscriptionDashboard() {
  const sections = getSubscriptionSections();

  if (!sections.length) {
    return "";
  }

  scheduleSubscriptionAutoPing(sections);

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
