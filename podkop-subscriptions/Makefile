include $(TOPDIR)/rules.mk

PKG_NAME:=podkop-subscriptions
PKG_VERSION:=$(if $(PODKOP_SUBSCRIPTIONS_VERSION),$(PODKOP_SUBSCRIPTIONS_VERSION),0.$(shell date +%d%m%Y))
PKG_RELEASE:=1

PKG_MAINTAINER:=asv-debug <stars.02akimenko@mail.ru>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/podkop-subscriptions
	SECTION:=net
	CATEGORY:=Network
	TITLE:=Podkop subscription importer addon
	URL:=https://github.com/asv-debug/Podkop_SUB
	PKGARCH:=all
endef

define Package/podkop-subscriptions/description
	Adds a LuCI subscription configuration type to an existing Podkop installation.
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/podkop-subscriptions/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/usr/share/podkop-subscriptions/apply.sh apply
exit 0
endef

define Package/podkop-subscriptions/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/usr/share/podkop-subscriptions/apply.sh restore
exit 0
endef

define Package/podkop-subscriptions/install
	$(INSTALL_DIR) $(1)/usr/share/podkop-subscriptions
	$(INSTALL_BIN) ./files/usr/share/podkop-subscriptions/apply.sh $(1)/usr/share/podkop-subscriptions/apply.sh

	$(INSTALL_DIR) $(1)/usr/share/podkop-subscriptions/payload
	$(INSTALL_DATA) ./files/usr/share/podkop-subscriptions/payload/section.js $(1)/usr/share/podkop-subscriptions/payload/section.js

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/podkop-subscriptions $(1)/usr/bin/podkop-subscriptions

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-podkop-subscriptions.json $(1)/usr/share/rpcd/acl.d/luci-app-podkop-subscriptions.json
endef

$(eval $(call BuildPackage,podkop-subscriptions))
