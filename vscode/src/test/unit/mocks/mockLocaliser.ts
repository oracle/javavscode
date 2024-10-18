const mockedL10n = {
    l10n: {
        value(key: string) {
            return key;
        },
        nbLocaleCode() {
            return 'en';
        },
    }
};

export const initMockedLocaliser = () => {
    return mockedL10n;
}
