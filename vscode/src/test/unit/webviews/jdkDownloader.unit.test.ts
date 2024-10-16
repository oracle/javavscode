import { suite, test } from 'mocha';
import * as sinon from 'sinon';
import * as chai from 'chai';
import { JdkDownloaderView } from '../../../webviews/jdkDownloader/view';
import { l10n } from '../../../localiser';

suite("JDK Downloader", () => {
    
suite("View tests", () => {
        test("Sum 1 and 2", () => {
            sinon.stub(l10n, "value").callsFake((key: string) => {
                return `Mocked translation for ${key}`;
            });
            new JdkDownloaderView();
            chai.expect((1 + 2) === 3, "Sum not equals");
        });
    });
});