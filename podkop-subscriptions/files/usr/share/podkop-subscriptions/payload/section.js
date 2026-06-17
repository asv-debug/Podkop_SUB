"use strict";
"require form";
"require baseclass";
"require ui";
"require fs";
"require uci";
"require tools.widgets as widgets";
"require view.podkop.main as main";

const USER_AGENTS = [
  ["auto", "Auto detect", "Автоопределение"],
  ["sing-box/1.12.0", "sing-box", "sing-box"],
  ["v2rayNG/1.9.31", "v2rayNG", "v2rayNG"],
  ["v2rayN/7.0", "v2rayN", "v2rayN"],
  ["HiddifyNext/2.5.7", "Hiddify Next", "Hiddify Next"],
  ["Happ/1.0", "Happ", "Happ"],
  ["NekoBox/1.3", "NekoBox", "NekoBox"],
  [
    "ClashMetaForAndroid/2.11.10",
    "Clash Meta for Android",
    "Clash Meta for Android",
  ],
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

function getFieldValue(sectionId, optionName, fallback) {
  const suffix = `.${sectionId}.${optionName}`;
  const fields = Array.from(document.querySelectorAll("input, select, textarea"));
  const field = fields.find((item) => {
    const id = item.getAttribute("id") || "";
    const name = item.getAttribute("name") || "";
    return id.endsWith(suffix) || name.endsWith(suffix);
  });

  if (!field) {
    return fallback || "";
  }

  return field.value || "";
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

function getFieldValues(sectionId, optionName, fallback) {
  const suffix = `.${sectionId}.${optionName}`;
  const fields = Array.from(document.querySelectorAll("input, select, textarea"));
  const values = fields
    .filter((item) => {
      const id = item.getAttribute("id") || "";
      const name = item.getAttribute("name") || "";
      return id.endsWith(suffix) || name.endsWith(suffix);
    })
    .map((item) => String(item.value || "").trim())
    .filter(Boolean);

  if (values.length > 0) {
    return Array.from(new Set(values));
  }

  return normalizeValues(fallback);
}

function getActiveSubscriptionLink(sectionId) {
  const selected = uci.get("podkop", sectionId, "subscription_selected_proxy_link");
  const selectorLinks = normalizeValues(
    uci.get("podkop", sectionId, "selector_proxy_links"),
  );

  return selected || (selectorLinks.length === 1 ? selectorLinks[0] : "") || "";
}

function loadSubscriptionServers(sectionId, button) {
  const subscriptionUrls = getFieldValues(
    sectionId,
    "subscription_urls",
    uci.get("podkop", sectionId, "subscription_urls") ||
      uci.get("podkop", sectionId, "subscription_url"),
  );
  const userAgent =
    getFieldValue(
      sectionId,
      "subscription_user_agent",
      uci.get("podkop", sectionId, "subscription_user_agent"),
    ) || "auto";
  const limit =
    getFieldValue(
      sectionId,
      "subscription_max_servers",
      uci.get("podkop", sectionId, "subscription_max_servers"),
    ) || "30";
  const oldText = button ? button.textContent : "";

  if (subscriptionUrls.length === 0) {
    ui.addNotification(
      null,
      E("p", {}, [i18n("Subscription URL is required", "Укажите URL подписки")]),
      "warning",
    );
    return Promise.resolve();
  }

  if (button) {
    button.disabled = true;
    button.textContent = i18n("Loading...", "Загрузка...");
  }

  return fs
    .exec("/usr/bin/podkop-subscriptions", [
      "sync",
      sectionId,
      subscriptionUrls.join("\n"),
      userAgent,
      limit,
    ])
    .then((response) => {
      const payload = parseResponse(response);
      if (!payload.success) {
        throw new Error(payload.error || response.stderr || "sync failed");
      }

      ui.addNotification(
        null,
        E("p", {}, [
          `${i18n("Subscription server list updated.", "Список серверов подписки обновлён")} (${payload.count || 0})`,
        ]),
        "info",
      );

      window.setTimeout(() => window.location.reload(), 800);
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

function installDashboardPingLabelPatch() {
  if (typeof window === "undefined" || window.__podkopSubscriptionPingLabelPatch) {
    return;
  }

  window.__podkopSubscriptionPingLabelPatch = true;

  const applyLabel = () => {
    if (typeof document === "undefined") {
      return;
    }

    document
      .querySelectorAll(".dashboard-sections-grid-item-test-latency")
      .forEach((button) => {
        const label = i18n("Ping", "Пинг");
        if (button.textContent !== label) {
          button.textContent = label;
        }
      });
  };

  window.setInterval(applyLabel, 2500);
  applyLabel();
}

installDashboardPingLabelPatch();

function createSectionContent(section) {
  let o = section.option(
    form.ListValue,
    "connection_type",
    _("Connection Type"),
    _("Select between VPN and Proxy connection methods for traffic routing"),
  );
  o.value("proxy", "Proxy");
  o.value("vpn", "VPN");
  o.value("block", "Block");
  o.value("exclusion", "Exclusion");

  o = section.option(
    form.ListValue,
    "proxy_config_type",
    _("Configuration Type"),
    _("Select how to configure the proxy"),
  );
  o.value("url", _("Connection URL"));
  o.value("subscription", i18n("Subscription", "Подписка"));
  o.value("selector", _("Selector"));
  o.value("urltest", _("URLTest"));
  o.value("outbound", _("Outbound Config"));
  o.default = "url";
  o.depends("connection_type", "proxy");
  o.cfgvalue = function (section_id) {
    const value = uci.get("podkop", section_id, "proxy_config_type") || "url";
    const subscriptionUrls =
      uci.get("podkop", section_id, "subscription_urls") ||
      uci.get("podkop", section_id, "subscription_url");
    const subscriptionLinks = uci.get(
      "podkop",
      section_id,
      "subscription_proxy_links",
    );
    const selectedLink = uci.get(
      "podkop",
      section_id,
      "subscription_selected_proxy_link",
    );

    if (subscriptionUrls || subscriptionLinks || selectedLink) {
      return "subscription";
    }

    return value;
  };
  o.write = function (section_id, value) {
    if (value === "subscription") {
      if (getActiveSubscriptionLink(section_id)) {
        uci.set("podkop", section_id, "proxy_config_type", "selector");
      }
      return;
    }

    uci.set("podkop", section_id, "proxy_config_type", value);
    uci.unset("podkop", section_id, "subscription_url");
    uci.unset("podkop", section_id, "subscription_urls");
    uci.unset("podkop", section_id, "subscription_proxy_links");
    uci.unset("podkop", section_id, "subscription_selected_proxy_link");
    uci.unset("podkop", section_id, "subscription_user_agent");
    uci.unset("podkop", section_id, "subscription_max_servers");
  };

  o = section.option(
    form.TextValue,
    "proxy_string",
    _("Proxy Configuration URL"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2:// links")
  );
  o.depends("proxy_config_type", "url");
  o.rows = 5;
  // Enable soft wrapping for multi-line proxy URLs (e.g., for URLTest proxy links)
  o.wrap = "soft";
  // Render as a textarea to allow multiple proxy URLs/configs
  o.textarea = true;
  o.rmempty = false;
  o.sectionDescriptions = new Map();
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "subscription_urls",
    i18n("Subscription URLs", "URL подписок"),
  );
  o.depends("proxy_config_type", "subscription");
  o.rmempty = false;
  o.placeholder = "https://example.com/subscription";
  o.cfgvalue = function (section_id) {
    const urls = uci.get("podkop", section_id, "subscription_urls");
    const legacyUrl = uci.get("podkop", section_id, "subscription_url");

    if (urls && urls.length) {
      return urls;
    }

    return legacyUrl ? [legacyUrl] : [];
  };
  o.validate = function (section_id, value) {
    const urls = Array.isArray(value) ? value : [value];

    for (const item of urls) {
      const url = String(item || "").trim();

      if (!url) {
        continue;
      }

      const validation = main.validateUrl(url);
      if (!validation.valid) {
        return validation.message;
      }
    }

    return true;
  };
  o.write = function (section_id, value) {
    const urls = Array.from(new Set(normalizeValues(value)));

    uci.unset("podkop", section_id, "subscription_url");

    if (urls.length) {
      uci.set("podkop", section_id, "subscription_urls", urls);
    } else {
      uci.unset("podkop", section_id, "subscription_urls");
    }
  };

  o = section.option(
    form.ListValue,
    "subscription_user_agent",
    i18n("Subscription User-Agent", "User-Agent подписки"),
  );
  USER_AGENTS.forEach(([value, en, ru]) => {
    o.value(value, i18n(en, ru));
  });
  o.default = "auto";
  o.rmempty = false;
  o.depends("proxy_config_type", "subscription");

  o = section.option(
    form.Value,
    "subscription_max_servers",
    i18n("Server Limit", "Лимит серверов"),
  );
  o.default = "30";
  o.placeholder = "30";
  o.rmempty = false;
  o.depends("proxy_config_type", "subscription");
  o.validate = function (section_id, value) {
    if (!value || value.length === 0) {
      return true;
    }

    if (/^[0-9]+$/.test(value) && Number(value) >= 1 && Number(value) <= 100) {
      return true;
    }

    return i18n(
      "Must be a number in the range of 1 - 100",
      "Введите число от 1 до 100",
    );
  };

  o = section.option(
    form.DummyValue,
    "_subscription_actions",
    i18n("Subscription", "Подписка"),
  );
  o.rawhtml = true;
  o.depends("proxy_config_type", "subscription");
  o.cfgvalue = function (section_id) {
    return E(
      "button",
      {
        class: "btn cbi-button cbi-button-apply",
        type: "button",
        click: (ev) => loadSubscriptionServers(section_id, ev.currentTarget),
      },
      [i18n("Update server list", "Обновить список серверов")],
    );
  };

  o = section.option(
    form.TextValue,
    "outbound_json",
    _("Outbound Configuration"),
    _("Enter complete outbound configuration in JSON format"),
  );
  o.depends("proxy_config_type", "outbound");
  o.rows = 10;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateOutboundJson(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "selector_proxy_links",
    _("Selector Proxy Links"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2:// links")
  );
  o.depends("proxy_config_type", "selector");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "urltest_proxy_links",
    _("URLTest Proxy Links"),
    _("vless://, ss://, trojan://, socks4/5://, hy2/hysteria2:// links")
  );
  o.depends("proxy_config_type", "urltest");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateProxyUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.ListValue,
    "urltest_check_interval",
    _("URLTest Check Interval"),
    _("The interval between connectivity tests")
  );
  o.value("30s", _("Every 30 seconds"));
  o.value("1m", _("Every 1 minute"));
  o.value("3m", _("Every 3 minutes"));
  o.value("5m", _("Every 5 minutes"));
  o.default = "3m";
  o.depends("proxy_config_type", "urltest");

  o = section.option(
    form.Value,
    "urltest_tolerance",
    _("URLTest Tolerance"),
    _("The maximum difference in response times (ms) allowed when comparing servers")
  );
  o.default = "50";
  o.rmempty = false;
  o.depends("proxy_config_type", "urltest");
  o.validate = function (section_id, value) {
    if (!value || value.length === 0) {
      return true;
    }

    const parsed = parseFloat(value);

    if (/^[0-9]+$/.test(value) && !isNaN(parsed) && isFinite(parsed) && parsed >= 50 && parsed <= 1000) {
      return true;
    }

    return _('Must be a number in the range of 50 - 1000');
  };

  o = section.option(
    form.Value,
    "urltest_testing_url",
    _("URLTest Testing URL"),
    _("The URL used to test server connectivity")
  );
  o.value("https://www.gstatic.com/generate_204", "https://www.gstatic.com/generate_204 (Google)");
  o.value("https://cp.cloudflare.com/generate_204", "https://cp.cloudflare.com/generate_204 (Cloudflare)");
  o.value("https://captive.apple.com", "https://captive.apple.com (Apple)");
  o.value("https://connectivity-check.ubuntu.com", "https://connectivity-check.ubuntu.com (Ubuntu)")
  o.default = "https://www.gstatic.com/generate_204";
  o.rmempty = false;
  o.depends("proxy_config_type", "urltest");

  o.validate = function (section_id, value) {
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.Flag,
    "enable_udp_over_tcp",
    _("UDP over TCP"),
    _("Applicable for SOCKS and Shadowsocks proxy"),
  );
  o.default = "0";
  o.depends("connection_type", "proxy");
  o.rmempty = false;

  o = section.option(
    widgets.DeviceSelect,
    "interface",
    _("Network Interface"),
    _("Select network interface for VPN connection"),
  );
  o.depends("connection_type", "vpn");
  o.noaliases = true;
  o.nobridges = false;
  o.noinactive = false;
  o.filter = function (section_id, value) {
    // Blocked interface names that should never be selectable
    const blockedInterfaces = [
      "br-lan",
      "eth0",
      "eth1",
      "wan",
      "phy0-ap0",
      "phy1-ap0",
      "pppoe-wan",
      "lan",
    ];

    // Reject immediately if the value matches any blocked interface
    if (blockedInterfaces.includes(value)) {
      return false;
    }

    // Try to find the device object with the given name
    const device = this.devices.find((dev) => dev.getName() === value);

    // If no device is found, allow the value
    if (!device) {
      return true;
    }

    // Get the device type (e.g., "wifi", "ethernet", etc.)
    const type = device.getType();

    // Reject wireless-related devices
    const isWireless =
      type === "wifi" || type === "wireless" || type.includes("wlan");

    return !isWireless;
  };

  o = section.option(
    form.Flag,
    "domain_resolver_enabled",
    _("Domain Resolver"),
    _("Enable built-in DNS resolver for domains handled by this section"),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "vpn");

  o = section.option(
    form.ListValue,
    "domain_resolver_dns_type",
    _("DNS Protocol Type"),
    _("Select the DNS protocol type for the domain resolver"),
  );
  o.value("doh", _("DNS over HTTPS (DoH)"));
  o.value("dot", _("DNS over TLS (DoT)"));
  o.value("udp", _("UDP (Unprotected DNS)"));
  o.default = "udp";
  o.rmempty = false;
  o.depends("domain_resolver_enabled", "1");

  o = section.option(
    form.Value,
    "domain_resolver_dns_server",
    _("DNS Server"),
    _("Select or enter DNS server address"),
  );
  Object.entries(main.DNS_SERVER_OPTIONS).forEach(([key, label]) => {
    o.value(key, _(label));
  });
  o.default = "8.8.8.8";
  o.rmempty = false;
  o.depends("domain_resolver_enabled", "1");
  o.validate = function (section_id, value) {
    const validation = main.validateDNS(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "community_lists",
    _("Community Lists"),
    _("Select a predefined list for routing") +
      ' <a href="https://github.com/itdoginfo/allow-domains" target="_blank">github.com/itdoginfo/allow-domains</a>',
  );
  o.placeholder = "Service list";
  Object.entries(main.DOMAIN_LIST_OPTIONS).forEach(([key, label]) => {
    o.value(key, _(label));
  });
  o.rmempty = true;
  let lastValues = [];
  let isProcessing = false;

  o.onchange = function (ev, section_id, value) {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const values = Array.isArray(value) ? value : [value];
      let newValues = [...values];
      let notifications = [];

      const selectedRegionalOptions = main.REGIONAL_OPTIONS.filter((opt) =>
        newValues.includes(opt),
      );

      if (selectedRegionalOptions.length > 1) {
        const lastSelected =
          selectedRegionalOptions[selectedRegionalOptions.length - 1];
        const removedRegions = selectedRegionalOptions.slice(0, -1);
        newValues = newValues.filter(
          (v) => v === lastSelected || !main.REGIONAL_OPTIONS.includes(v),
        );
        notifications.push(
          E("p", {}, [
            E("strong", {}, _("Regional options cannot be used together")),
            E("br"),
            _(
              "Warning: %s cannot be used together with %s. Previous selections have been removed.",
            ).format(removedRegions.join(", "), lastSelected),
          ]),
        );
      }

      if (newValues.includes("russia_inside")) {
        const removedServices = newValues.filter(
          (v) => !main.ALLOWED_WITH_RUSSIA_INSIDE.includes(v),
        );
        if (removedServices.length > 0) {
          newValues = newValues.filter((v) =>
            main.ALLOWED_WITH_RUSSIA_INSIDE.includes(v),
          );
          notifications.push(
            E("p", { class: "alert-message warning" }, [
              E("strong", {}, _("Russia inside restrictions")),
              E("br"),
              _(
                "Warning: Russia inside can only be used with %s. %s already in Russia inside and have been removed from selection.",
              ).format(
                main.ALLOWED_WITH_RUSSIA_INSIDE.map(
                  (key) => main.DOMAIN_LIST_OPTIONS[key],
                )
                  .filter((label) => label !== "Russia inside")
                  .join(", "),
                removedServices.join(", "),
              ),
            ]),
          );
        }
      }

      if (JSON.stringify(newValues.sort()) !== JSON.stringify(values.sort())) {
        this.getUIElement(section_id).setValue(newValues);
      }

      notifications.forEach((notification) =>
        ui.addNotification(null, notification),
      );
      lastValues = newValues;
    } catch (e) {
      console.error("Error in onchange handler:", e);
    } finally {
      isProcessing = false;
    }
  };

  o = section.option(
    form.ListValue,
    "user_domain_list_type",
    _("User Domain List Type"),
    _("Select the list type for adding custom domains"),
  );
  o.value("disabled", _("Disabled"));
  o.value("dynamic", _("Dynamic List"));
  o.value("text", _("Text List"));
  o.default = "disabled";
  o.rmempty = false;

  o = section.option(
    form.DynamicList,
    "user_domains",
    _("User Domains"),
    _(
      "Enter domain names without protocols, e.g. example.com or sub.example.com",
    ),
  );
  o.placeholder = "Domains list";
  o.depends("user_domain_list_type", "dynamic");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateDomain(value, true);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "user_domains_text",
    _("User Domains List"),
    _(
      "Enter domain names separated by commas, spaces, or newlines. You can add comments using //",
    ),
  );
  o.placeholder =
    "example.com, sub.example.com\n// Social networks\ndomain.com test.com // personal domains";
  o.depends("user_domain_list_type", "text");
  o.rows = 8;
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const domains = main.parseValueList(value);

    if (!domains.length) {
      return _(
        "At least one valid domain must be specified. Comments-only content is not allowed.",
      );
    }

    const { valid, results } = main.bulkValidate(domains, (row) =>
      main.validateDomain(row, true),
    );

    if (!valid) {
      const errors = results
        .filter((validation) => !validation.valid) // Leave only failed validations
        .map((validation) => `${validation.value}: ${validation.message}`); // Collect validation errors

      return [_("Validation errors:"), ...errors].join("\n");
    }

    return true;
  };

  o = section.option(
    form.ListValue,
    "user_subnet_list_type",
    _("User Subnet List Type"),
    _("Select the list type for adding custom subnets"),
  );
  o.value("disabled", _("Disabled"));
  o.value("dynamic", _("Dynamic List"));
  o.value("text", _("Text List"));
  o.default = "disabled";
  o.rmempty = false;

  o = section.option(
    form.DynamicList,
    "user_subnets",
    _("User Subnets"),
    _(
      "Enter subnets in CIDR notation (e.g. 103.21.244.0/22) or single IP addresses",
    ),
  );
  o.placeholder = "IP or subnet";
  o.depends("user_subnet_list_type", "dynamic");
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateSubnet(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.TextValue,
    "user_subnets_text",
    _("User Subnets List"),
    _(
      "Enter subnets in CIDR notation or single IP addresses, separated by commas, spaces, or newlines. " +
        "You can add comments using //",
    ),
  );
  o.placeholder =
    "103.21.244.0/22\n// Google DNS\n8.8.8.8\n1.1.1.1/32, 9.9.9.9 // Cloudflare and Quad9";
  o.depends("user_subnet_list_type", "text");
  o.rows = 10;
  o.rmempty = false;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const subnets = main.parseValueList(value);

    if (!subnets.length) {
      return _(
        "At least one valid subnet or IP must be specified. Comments-only content is not allowed.",
      );
    }

    const { valid, results } = main.bulkValidate(subnets, main.validateSubnet);

    if (!valid) {
      const errors = results
        .filter((validation) => !validation.valid) // Leave only failed validations
        .map((validation) => `${validation.value}: ${validation.message}`); // Collect validation errors

      return [_("Validation errors:"), ...errors].join("\n");
    }

    return true;
  };

  o = section.option(
    form.DynamicList,
    "local_domain_lists",
    _("Local Domain Lists"),
    _("Specify the path to the list file located on the router filesystem"),
  );
  o.placeholder = "/path/file.lst";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validatePath(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "local_subnet_lists",
    _("Local Subnet Lists"),
    _("Specify the path to the list file located on the router filesystem"),
  );
  o.placeholder = "/path/file.lst";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validatePath(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "remote_domain_lists",
    _("Remote Domain Lists"),
    _("Specify remote URLs to download and use domain lists"),
  );
  o.placeholder = "https://example.com/domains.srs";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "remote_subnet_lists",
    _("Remote Subnet Lists"),
    _("Specify remote URLs to download and use subnet lists"),
  );
  o.placeholder = "https://example.com/subnets.srs";
  o.rmempty = true;
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateUrl(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.DynamicList,
    "fully_routed_ips",
    _("Fully Routed IPs"),
    _(
      "Specify local IP addresses or subnets whose traffic will always be routed through the configured route",
    ),
  );
  o.placeholder = "192.168.1.2 or 192.168.1.0/24";
  o.rmempty = true;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
  o.validate = function (section_id, value) {
    // Optional
    if (!value || value.length === 0) {
      return true;
    }

    const validation = main.validateSubnet(value);

    if (validation.valid) {
      return true;
    }

    return validation.message;
  };

  o = section.option(
    form.Flag,
    "mixed_proxy_enabled",
    _("Enable Mixed Proxy"),
    _(
      "Enable the mixed proxy, allowing this section to route traffic through both HTTP and SOCKS proxies",
    ),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");

  o = section.option(
    form.Value,
    "mixed_proxy_port",
    _("Mixed Proxy Port"),
    _(
      "Specify the port number on which the mixed proxy will run for this section. " +
        "Make sure the selected port is not used by another service",
    ),
  );
  o.rmempty = false;
  o.depends("mixed_proxy_enabled", "1");

  o = section.option(
    form.Flag,
    "resolve_real_ip_for_routing",
    _("Resolve real IP for routing"),
    _("Enable DNS resolve to get real IP when routing"),
  );
  o.default = "0";
  o.rmempty = false;
  o.depends("connection_type", "proxy");
  o.depends("connection_type", "vpn");
}

const EntryPoint = {
  createSectionContent,
};

return baseclass.extend(EntryPoint);
