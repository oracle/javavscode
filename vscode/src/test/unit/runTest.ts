import * as Mocha from 'mocha';
import { glob } from 'glob';
import * as path from 'path';


const mocha = new Mocha({
    ui: 'tdd',
    color: true
});


const testRunner = async (modules: string[] = []) => {
    return new Promise<void>((c, e) => {
        glob('**/**.unit.test.js', { cwd: __dirname }, (err, files) => {
            if (err) {
                return e(err);
            }
            // Add files to the test suite
            files.forEach(f => {
                if (!modules.length) {
                    mocha.addFile(path.resolve(__dirname, f));
                } else if (modules.includes(f.split('.')[0])) {
                    mocha.addFile(path.resolve(__dirname, f));
                }
            });

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
try {
    const args = process.argv.slice(2);
    if (args.length) {
        console.log(`Running unit tests for following speicified modules: ${args.map(el => el)}`);
    }
    testRunner(args);
} catch (err: any) {
    console.error("Exception occurred while running tests");
    console.error(err?.message || "");
}