FORMATGPT PROJECT MAP
=======================

## Top-level
- index.html
  - Loads CSS/JS in the right order
  - Has the DOM structure: header, input <textarea#inp>, output <pre#out>, mode dropdown, Blue toggle, Paste/Copy split buttons, Add Mail checkbox, Settings gear
  - Change here when: you need to add/remove UI elements or new menus/buttons (rare)

## CSS
- css/theme.css
  - Global look & feel (colors, spacing, card styles)
  - Blue button styles, dropdown/menu styles, split buttons, textarea/pre, hints
  - Change here when: button sizes, colors, glow, spacing, dropdown visual tweaks
- css/header.css
  - Extra header-only styles
  - Change here when: header layout/animation only

## Core JS
- js/config.js
  - Constants: default mail URL, follower thresholds, phone length range
  - Change here when: rules/thresholds change
- js/state.js
  - App state: current mode, Blue toggle, Add Mail checkbox, stored Mail Access
  - initState() loads saved settings; setMailAccess() normalizes + persists
  - Change here when: you add persistent settings or global flags
- js/utils.js
  - Low-level helpers/validators:
    - parsing delimiters (: ; , ----)
    - checks: email, hex40, 2FA key, year, phone, “ct0” suppression
    - username normalization (keeps 0x prefixes)
    - token coalescing for lines broken across rows
    - number → K formatting; sorting by counts
  - Change here when: parsing rules/validators or shared utilities need updates
- js/renderers.js
  - Logic that builds output text (Standard block lines)
  - Picks username for plinks; extracts followers safely; reverse helpers
  - Blue block rendering + Mail Access lines
  - Change here when: output format changes (new lines, order, how fields print)
- js/main.js
  - Mode registry (registerMode), set mode, run current mode, final “append mail” block, save-as-txt filename logic
  - Change here when: you add a global post-process step or a new way to save/export
- js/ui.js
  - Wires DOM to logic: buttons, menus, dropdown, paste/upload, copy/save, settings
  - Exposes App.boot (start the app)
  - Change here when: button behavior or menu behavior changes (not visuals)

## Modes
- js/modes/standard.js
  - Splits input → Standard formatted blocks via renderStandard()
- js/modes/xfly.js
  - Outputs username:password:2FAKEY
- js/modes/reverse.js
  - Converts formatted blocks back to raw colon/semicolon/comma-delimited form
- js/modes/plinks-with.js
  - Produces x.com/username [count], sorts by count desc
- js/modes/plinks-without.js
  - Produces x.com/username (no counts)
- js/modes/convert.js
  - Accepts usernames or profile links + optional counts; outputs x.com/username [K]; sorts by count desc

## Common tweak cookbook
- Change how a field is detected (email/phone/year/2FA/token):
  edit js/utils.js (validators) and/or js/renderers.js (parse loop in renderStandard)

- Change the order of output lines, add/remove a line:
  edit js/renderers.js → renderStandard()

- Suppress ct0-like junk or merge long tokens onto previous line:
  edit js/utils.js → isCt0() and coalesceTokenOnlyRows()

- Change Blue block look (glow, colors, smoothness):
  edit css/theme.css (.blue-btn styles & .is-on state)

- Change menus/dropdowns behavior (open/close, items):
  edit js/ui.js

- Add a new mode:
  1) create js/modes/my-new-mode.js
  2) register it in that file with App.App.registerMode(...)
  3) add <li class="dd-item" data-value="myNew">My New Mode</li> in index.html
  4) include <script src="js/modes/my-new-mode.js"></script> in index.html

- Add smart prompt warnings:
  put them inside the specific mode run(text) so it only affects that mode

## Change flow
1) You tell me the tweak/feature
2) I’ll say which file(s) and where
3) I send a small snippet to paste
4) You refresh and test
