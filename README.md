# Dreame HA Panel

Własny panel HTML/CSS/JavaScript do Home Assistant dla Dreame L50 Ultra AE: polski interfejs, własna mapa SVG, wybór pomieszczeń, suwaki i diagnostyka.

**Prywatność:** publiczny projekt nie zawiera współrzędnych pomieszczeń, prywatnych nazw pokoi, adresów ani danych logowania. Mapę przekazuje się wyłącznie w lokalnym YAML dashboardu Home Assistant.

## Instalacja — jednorazowo

1. Utwórz w HA katalogi `/config/www` i `/config/dreame`.
2. Skopiuj pliki [dreame-loader.js](dreame-loader.js) do `/config/www/dreame-loader.js` oraz [update_dreame.py](update_dreame.py) do `/config/dreame/update_dreame.py`.
3. Do `/config/configuration.yaml` dodaj `shell_command` z [configuration-example.yaml](configuration-example.yaml). Jeśli jest już sekcja `shell_command:`, **nie duplikuj** jej — dopisz tylko `dreame_panel_update`.
4. Zweryfikuj konfigurację i przeładuj `shell_command` lub uruchom HA ponownie.
5. Uruchom akcję `shell_command.dreame_panel_update` w Narzędziach deweloperskich → Akcje. Pobierze `dreame-html-card.js` do `/config/www`.
6. Ustawienia → Pulpity → ⋮ → Zasoby: usuń dotychczasowy zasób `/local/dreame-html-card.js?...` i dodaj `/local/dreame-loader.js?v=1` jako **Moduł JavaScript**.
7. W popupie Bubble Card użyj `type: custom:dreame-auto-card` z prywatnym blokiem `rooms`. Główny kafelek z hashem `#dreame-v2` pozostaje bez zmian. **Nie publikuj prawdziwego YAML z pokojami.**
8. Utwórz automatyzację z [automation-example.yaml](automation-example.yaml) w edytorze YAML automatyzacji HA.
9. Wykonaj pełne odświeżenie dashboardu.

Przykład struktury popupu **ze sztucznym pokojem (nie używaj zamiast prawdziwej mapy)**:

```yaml
type: custom:bubble-card
card_type: pop-up
hash: "#dreame-v2"
name: Dreame Control Center
cards:
  - type: custom:dreame-auto-card
    rooms:
      - id: "1"
        name: "Przykładowy pokój"
        x: 0
        y: 0
        p: [[-100,-100],[100,-100],[100,100],[-100,100]]
```

## Działanie aktualizacji

HA pobiera nową wersję przy uruchomieniu i co 6 godzin. Skrypt tworzy kopię starej wersji w `/config/dreame-panel-backups/` i podmienia kod atomowo. **Załadowanie nowego JS wymaga pełnego odświeżenia strony**, ponieważ zarejestrowane klasy JavaScript pozostają aktywne do końca bieżącej sesji.

## Cofanie

Wyłącz automatyzację aktualizacji, przywróć wybraną kopię z `/config/dreame-panel-backups/` jako `/config/www/dreame-html-card.js` i odśwież dashboard.

## Bezpieczeństwo i ograniczenia

Zdalnie pobrany JavaScript wykonuje się z uprawnieniami Twojej sesji HA, dlatego zapisywać w repozytorium powinni wyłącznie zaufani użytkownicy. Aktualizator sprawdza wielkość i podstawowy format pliku, ale **nie weryfikuje podpisu kryptograficznego**. Pierwsza wersja wymaga przetestowania na działającym HA, zwłaszcza kalibracji mapy. Nie zapisuj w tym publicznym repozytorium haseł, tokenów ani współrzędnych Twojego domu.
