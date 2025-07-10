import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import { transformValue, replaceAllOccurrences, getValuesToBeTransformed } from "../../../telemetry/utils";
import * as sinon from 'sinon';
import * as os from 'os';

const replacedValue = "_REM_";
const propertiesToTransform = ["message", "b", "c", "d"];

describe("transformValue()", () => {
    it("replaces top-level string if key is in propertiesToTransform", () => {
        const result = transformValue("message", ["john"], propertiesToTransform, replacedValue, "hello john");
        expect(result).to.equal(`hello ${replacedValue}`);
    });

    it("does not replace if key is not in propertiesToTransform", () => {
        const result = transformValue("greeting", ["john"], propertiesToTransform, replacedValue, "hello john");
        expect(result).to.equal("hello john");
    });

    it("replaces nested name values for matching keys only", () => {
        const input = {
            b: "john is here",
            c: ["john", { d: "also john" }]
        };

        const result = transformValue("a", ["john"], propertiesToTransform, replacedValue, input);

        expect(result.b).to.equal(`${replacedValue} is here`);
        expect(result.c[0]).to.equal(`${replacedValue}`);
        expect(result.c[1].d).to.equal(`also ${replacedValue}`);
    });

    it("handles keys with deep nesting", () => {
        const blocked = ["john", "doe"];
        const data = {
            level1: {
                message: "john was here",
                test: "john was here",
                b: ["hello john", "doe speaks", "java"],
                nestedArray: [
                    {
                        b: "john and doe",
                        other: "keep this"
                    },
                    {
                        b: "john is safe",
                        d: ["john doe", { d: "doe and john" }]
                    }
                ]
            },
            c: [
                {
                    d: "test john",
                    random: "doe"
                },
                {
                    a: {
                        b: "john"
                    },
                    b: "john and jane",
                    d: null
                }
            ],
            extra: "nothing here"
        };

        const result = transformValue(null, blocked, propertiesToTransform, replacedValue, data);

        expect(result.level1.message).to.equal(`${replacedValue} was here`);
        expect(result.level1.test).to.equal("john was here");
        expect(result.level1.b).to.deep.equal([`hello ${replacedValue}`, `${replacedValue} speaks`, "java"]);
        expect(result.level1.nestedArray[0].b).to.equal(`${replacedValue} and ${replacedValue}`);
        expect(result.level1.nestedArray[0].other).to.equal("keep this");

        expect(result.level1.nestedArray[1].b).to.equal(`${replacedValue} is safe`);
        expect(result.level1.nestedArray[1].d[0]).to.equal(`${replacedValue} ${replacedValue}`);
        expect(result.level1.nestedArray[1].d[1].d).to.equal(`${replacedValue} and ${replacedValue}`);

        expect(result.c[0].d).to.equal(`test ${replacedValue}`);
        expect(result.c[0].random).to.equal("doe");

        expect(result.c[1].a.b).to.equal(`${replacedValue}`);
        expect(result.c[1].b).to.equal(`${replacedValue} and jane`);
        expect(result.c[1].d).to.equal(null);

        expect(result.extra).to.equal("nothing here");
    });

    it("does not transform primitive values", () => {
        const data = {
            count: 5,
            flag: true,
            nothing: null
        };
        const result = transformValue(null, ["john"], propertiesToTransform, replacedValue, data);

        expect(result.count).to.equal(5);
        expect(result.flag).to.equal(true);
        expect(result.nothing).to.equal(null);
    });

    it("returns original string if no blocked values", () => {
        const result = transformValue("message", [], propertiesToTransform, replacedValue, "hello john");
        expect(result).to.equal("hello john");
    });
});

describe("replaceAllOccurrences()", () => {
    it("replaces all non-overlapping occurrences", () => {
        const result = replaceAllOccurrences("john is john", "john", "_REM_");
        expect(result).to.equal("_REM_ is _REM_");
    });

    it("does not change string if valueString not found", () => {
        const result = replaceAllOccurrences("hello world", "john", "_REM_");
        expect(result).to.equal("hello world");
    });

    it("replaces multiple adjacent matches", () => {
        const result = replaceAllOccurrences("johnjohnjohn", "john", "_REM_");
        expect(result).to.equal("_REM__REM__REM_");
    });

    it("returns original string if valueString is empty", () => {
        const result = replaceAllOccurrences("john is here", "", "_REM_");
        expect(result).to.equal("john is here");
    });

    it("can replace special characters (treated literally)", () => {
        const result = replaceAllOccurrences("price is $5.00 and $5.00", "$5.00", "_REM_");
        expect(result).to.equal("price is _REM_ and _REM_");
    });

    it("is case-sensitive by default", () => {
        const result = replaceAllOccurrences("John john JOHN", "john", "_REM_");
        expect(result).to.equal("John _REM_ JOHN");
    });

    it("handles overlapping cases (only first per loop)", () => {
        const result = replaceAllOccurrences("aaa", "aa", "_X_");
        expect(result).to.equal("_X_a");
    });
});

describe("transformValue() with getValuesToBeTransformed()", () => {
    let stub: sinon.SinonStub;

    beforeEach(() => {
        stub = sinon.stub(os, "userInfo").returns({ username: "john" } as os.UserInfo<string>);
    });

    afterEach(() => {
        stub.restore();
    });

    it("transforms string using values from getValuesToBeTransformed", () => {
        const blocked = getValuesToBeTransformed();

        const result = transformValue("message", blocked, propertiesToTransform, replacedValue, "hello john");

        expect(result).to.equal(`hello ${replacedValue}`);
    });

    it("does not transform if key is not in propertiesToTransform", () => {
        const blocked = getValuesToBeTransformed();

        const result = transformValue("greeting", blocked, propertiesToTransform, replacedValue, "hello john");

        expect(result).to.equal("hello john");
    });

    it("filters ignored and short env values correctly", () => {
        const testEnv = {
            SUDO_USER: "ja",
            C9_USER: "java",
            LOGNAME: "john",
            USER: "oracle",
            LNAME: "ab",
            USERNAME: "johndoe",
            HOSTNAME: undefined,
            COMPUTERNAME: "user",
            NAME: "vscode"
        };

        const stubbed = sinon.stub(process, "env").value(testEnv as any);
        stub.restore();

        const values = getValuesToBeTransformed();

        expect(values).to.include("john");
        expect(values).to.include("johndoe");
        expect(values).to.not.include("java");
        expect(values).to.not.include("user");
        expect(values).to.not.include("ab");
        expect(values).to.not.include("vscode");

        stubbed.restore();
    });
});