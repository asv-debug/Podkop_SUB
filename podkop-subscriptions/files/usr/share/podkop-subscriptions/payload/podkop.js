"use strict";
"require view";
"require form";
"require baseclass";
"require network";
"require view.podkop.main as main";

// Settings content
"require view.podkop.settings as settings";

// Sections content
"require view.podkop.section as section";

// Dashboard content
"require view.podkop.dashboard as dashboard";

// Diagnostic content
"require view.podkop.diagnostic as diagnostic";

// Subscription import content
"require view.podkop.subscriptions as subscriptions";

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

const EntryPoint = {
  async render() {
    main.injectGlobalStyles();

    const podkopMap = new form.Map(
      "podkop",
      _("Podkop Settings"),
      _("Configuration for Podkop service"),
    );
    // Enable tab views
    podkopMap.tabbed = true;

    // Sections tab
    const sectionsSection = podkopMap.section(
      form.TypedSection,
      "section",
      _("Sections"),
    );
    sectionsSection.anonymous = false;
    sectionsSection.addremove = true;
    sectionsSection.template = "cbi/simpleform";

    // Render section content
    section.createSectionContent(sectionsSection);

    // Settings tab
    const settingsSection = podkopMap.section(
      form.TypedSection,
      "settings",
      _("Settings"),
    );
    settingsSection.anonymous = true;
    settingsSection.addremove = false;
    // Make it named [ config settings 'settings' ]
    settingsSection.cfgsections = function () {
      return ["settings"];
    };

    // Render settings content
    settings.createSettingsContent(settingsSection);

    // Subscriptions tab
    const subscriptionsSection = podkopMap.section(
      form.TypedSection,
      "subscriptions",
      i18n("Subscriptions", "Подписки"),
    );
    subscriptionsSection.anonymous = true;
    subscriptionsSection.addremove = false;
    subscriptionsSection.cfgsections = function () {
      return ["subscriptions"];
    };

    // Render subscriptions content
    subscriptions.createSubscriptionsContent(subscriptionsSection);

    // Diagnostic tab
    const diagnosticSection = podkopMap.section(
      form.TypedSection,
      "diagnostic",
      _("Diagnostics"),
    );
    diagnosticSection.anonymous = true;
    diagnosticSection.addremove = false;
    diagnosticSection.cfgsections = function () {
      return ["diagnostic"];
    };

    // Render diagnostic content
    diagnostic.createDiagnosticContent(diagnosticSection);

    // Dashboard tab
    const dashboardSection = podkopMap.section(
      form.TypedSection,
      "dashboard",
      _("Dashboard"),
    );
    dashboardSection.anonymous = true;
    dashboardSection.addremove = false;
    dashboardSection.cfgsections = function () {
      return ["dashboard"];
    };

    // Render dashboard content
    dashboard.createDashboardContent(dashboardSection);

    // Inject core service
    main.coreService();

    return podkopMap.render();
  },
};

return view.extend(EntryPoint);
