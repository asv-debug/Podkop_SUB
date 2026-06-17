# Podkop Subscriptions Addon

Дополнение для уже установленного Podkop на OpenWrt. Пакет добавляет тип конфигурации `Subscription` в секции LuCI Podkop и использует штатный Dashboard Podkop для выбора сервера.

В секции можно вставить URL подписки и загрузить серверы в Dashboard. Addon сохраняет серверы как штатный selector Podkop:

- `connection_type=proxy`
- `proxy_config_type=selector`
- `selector_proxy_links=<imported proxy links>`

После импорта Podkop применяется автоматически. Дальше сервер выбирается карточкой в Dashboard без перезапуска Podkop, через существующий sing-box selector API. Кнопка ping для всей группы серверов также находится в Dashboard.

## Поддерживаемые подписки

Addon пробует несколько User-Agent для обычных client subscription endpoints: Happ, Hiddify Next, v2rayN, v2rayNG, NekoBox, Clash Meta for Android, sing-box, Shadowrocket и curl.

Поддерживаются plain/base64/base64url списки, JSON/YAML-обертки с proxy-ссылками, а также Happ/v2ray JSON-конфиги, где серверы описаны через `outbounds`. Сейчас импортируются ссылки:

- `vless://`
- `ss://`
- `trojan://`
- `socks4://`
- `socks4a://`
- `socks5://`
- `hysteria2://`
- `hy2://`

## Требования

- Установленный Podkop и luci-app-podkop.
- OpenWrt с `opkg` или `apk`.
- Доступ роутера к URL подписки.

## Установка

```sh
wget -O - https://raw.githubusercontent.com/asv-debug/Podkop_SUB/main/install.sh | sh
```

Если GitHub Raw недоступен с роутера:

```sh
wget -O - https://cdn.jsdelivr.net/gh/asv-debug/Podkop_SUB@main/install.sh | sh
```

После установки откройте LuCI: `Services -> Podkop -> Sections`.

Установщик сначала пробует стабильный URL последнего релиза:

- `https://github.com/asv-debug/Podkop_SUB/releases/latest/download/podkop-subscriptions.ipk`
- `https://github.com/asv-debug/Podkop_SUB/releases/latest/download/podkop-subscriptions.apk`

## Как пользоваться

1. В нужной секции выберите `Connection Type: Proxy`.
2. Выберите `Configuration Type: Subscription`.
3. Вставьте URL подписки.
4. Оставьте `User-Agent` в режиме автоопределения или выберите нужный клиент вручную.
5. Нажмите `Загрузить в Dashboard`.
6. Откройте `Dashboard`, нажмите `Ping/Test latency` для проверки всех серверов секции.
7. Выберите сервер кликом по карточке.

## Что делает пакет

- Делает backup исходного `/www/luci-static/resources/view/podkop/section.js`.
- Восстанавливает `/usr/bin/podkop`, `/usr/lib/podkop/helpers.sh` и `section.js` из backup, если они были изменены старыми версиями addon.
- Восстанавливает исходный `/www/luci-static/resources/view/podkop/podkop.js`, если он был изменен версиями 0.2.x с отдельной вкладкой `Подписки`.
- Добавляет тип `Subscription` в `Configuration Type`.
- Устанавливает `/usr/bin/podkop-subscriptions`.
- Добавляет ACL для LuCI/rpcd.
- Удаляет старые cron-задания `podkop-subscription-update-*`, если они остались от версий 0.1.x.
- Не заменяет весь Podkop и меняет только выбранную секцию при нажатии `Загрузить в Dashboard`.

## Удаление

```sh
opkg remove podkop-subscriptions
```

или для APK-based OpenWrt:

```sh
apk del podkop-subscriptions
```

При удалении пакет пытается восстановить файлы из backup и очищает кэш LuCI.
