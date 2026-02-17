/*
  Copyright (c) 2023-2026, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export const downloaderCss = `
/* =========================
    Base / element resets
   ========================= */
summary {
    cursor: pointer;
}
summary::-webkit-details-marker {
    display: none;
}
summary::marker {
    content: "";
}

fieldset {
    border: 0;
    padding: 0;
    margin-top: 1em;
    min-width: 0;
}

/* =========================
    Layout utilities / structure
   ========================= */
.panel {
    background-color: color-mix(in srgb, var(--vscode-banner-background) 75%, transparent);
    border-radius: 1.5em;
    padding: 2.5em;
}

.spacer {
    flex: 1 1 auto;
}

.row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
}

.bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

@media (max-width: 900px) {
    .bottom-row {
      flex-direction: column;
      align-items: flex-start;
    }
}

/* =========================
    Content blocks
   ========================= */
.lead p {
    margin-top: 0;
}

.detected {
    margin-bottom: 1.5em;
    gap: 0.75em 1.5em;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
}

.license {
    margin: 0.5em 0 0 0;
    font-size: 0.9em;
}

/* =========================
    Buttons / icons
   ========================= */
.jdk-confirm-button {
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
    border: 0.1em solid var(--vscode-button-border);
    border-radius: 0.25em;
    margin: auto;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
}
.jdk-confirm-button:hover {
    background-color: var(--vscode-button-hoverBackground);
}
.jdk-confirm-button:focus {
    outline: 0.25em solid var(--vscode-button-hoverBackground);
    outline-offset: 0.2em;
}

.icon {
    width: 1.75em;
    height: 1.75em;
    fill: currentColor;
}

/* =========================
    Other options accordion
   ========================= */
summary.other-options__summary {
    display: flex;
    align-items: center;
    user-select: none;
    gap: 0.5em;
    padding: 0.75em 0.1em;
}

/* Chevron */
summary.other-options__summary::before {
    content: "\u203a";
    display: inline-block;
    transform: rotate(0deg);
    transition: transform 0.18s ease;
    font-size: 2.4em;
    line-height: 1;
}
details.other-options[open] > summary.other-options__summary::before {
    transform: rotate(90deg);
}

.other-options__body {
    padding-left: 1.5em; /* indent under chevron */
}

/* =========================
    "Change" nested details (styled like a link)
   ========================= */
details.change {
    display: inline-block;
}
summary.change__summary {
    display: inline-block;
    color: var(--vscode-textlink-foreground);
    text-decoration: underline;
}
.change__body {
    margin-top: 1em;
}

/* =========================
    Radio choices
   ========================= */
.choices {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
}
.choice {
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding-right: 2em;
}

/* =========================
    JDK version dropdowns
   ========================= */
.jdk-version-container {
    justify-content: space-around;
    flex-wrap: wrap;
    margin: 1em 0 2em 0;
}

.jdk-version-label {
    font-size: 1em;
}

.jdk-version-dropdown {
    position: relative;
    display: flex;
    border-radius: 0.25em;
    overflow: hidden;
    margin: 0.5em 0.5em 0 0;
    padding-right: 0.25em;
}
.jdk-version-dropdown::after {
    content: "\u25BC";
    position: absolute;
    top: 25%;
    right: 1em;
    font-size: 0.9em;
    transition: 0.25s all ease;
    pointer-events: none;
    color: var(--vscode-dropdown-foreground);
}
.jdk-version-dropdown:hover::after {
    color: var(--vscode-input-placeholderForeground);
}

select.select {
    appearance: none;
    -webkit-appearance: none;
    border: 0.1em solid var(--vscode-dropdown-border);
    border-radius: 0.25em;
    box-shadow: none;
    flex: 1;
    padding: 0.5em 1.5em 0.5em 0.5em;
    cursor: pointer;
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
}
select.select::-ms-expand {
    display: none;
}
select.select:focus {
    outline: none;
}

/* =========================
    Conditional sections (CSS-only toggles)
   ========================= */
.other-options__body .openJdk-license {
    display: block;
}
/* show only when oracleJdk is not selected */
.other-options__body:has(input[name="jdkType"][value="oracleJdk"]:checked) .openJdk-license {
    display: none;
}

.other-options__body .openJdk-control {
    display: none;
}
/* show only when openJdk is selected */
.other-options__body:has(input[name="jdkType"][value="openJdk"]:checked) .openJdk-control {
    display: flex;
}

.other-options__body .oracleJdk-control {
    display: none;
}
/* show only when oracleJdk is selected */
.other-options__body:has(input[name="jdkType"][value="oracleJdk"]:checked) .oracleJdk-control {
    display: flex;
}
`