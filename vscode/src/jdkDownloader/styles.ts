export const downloaderCss = `
.select-jdk {
    background-color: #007ACC;
    border: none;
    color: white;
    padding: 0.9em 1.8em;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 0.9em;
    cursor: pointer;
    margin: 0px 1em;
}

.active {
    background-color: #3399FF;
}

.select-jdk:hover {
    background-color: #3399FF;
}

select {
    appearance: none;
    border: 0;
    box-shadow: none;
    flex: 1;
    padding: 0 1em;
    color: #fff;
    background-color: #333337;
    cursor: pointer;
}

select::-ms-expand {
    display: none;
}

select:focus {
    outline: none;
}

.jdk-version-dropdown {
    position: relative;
    display: flex;
    width: 15em;
    height: 3em;
    border-radius: 0.25em;
    overflow: hidden;
    margin-top: 0.75em;
}

.jdk-version-dropdown::after {
    content: '\u25BC';
    position: absolute;
    top: 0;
    right: 0;
    padding: 1em;
    background-color: #333337;
    color: #999999;
    transition: 0.25s all ease;
    pointer-events: none;
}

.jdk-version-dropdown:hover::after {
    color: #656565;
}

.jdk-version-container {
    display: none;
    justify-content: space-around;
    flex-wrap: wrap;
    margin: 2em 1em;
}

.jdk-version-label {
    font-size: 1em;
}

.jdk-confirm-button {
    margin: 2em auto 0 33%;
}

.jdk-flex-basis {
    flex-basis: 33%;
}

.margin-one {
    margin: 1em;
}

.display-flex {
    display: flex;
}

.button-height {
    height: 100%;
}

.margin-or {
    margin-top: 0.6em;
    margin-right: 0.5em;
}
`