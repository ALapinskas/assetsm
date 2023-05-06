import assert from 'assert';
import puppeteer from 'puppeteer';
import AssetsManager from '../src/AssetsManager.js';

let browser, page;

describe('Assets Manager module testing', function () {
    before(async () => {
        browser = await puppeteer.launch({headless: false});
        page = await browser.newPage();

        await page.goto('http://127.0.0.1:8080/examples');
    });

    after(async () => {
        console.log("close browser");
        //await browser.close();
    });

    describe('adding, loading, retrieving', () => {
        it('should create an instance of AssetsManager, module methods should be available', async (done) => {
            
                const three = await page.evaluate(async () => {
                    try {
                        const module = await import('../src/AssetsManager.js');
                        const AssetsManager = module.default,
                            loader = new AssetsManager();
                        console.log("page evaluate");
                        //const loader = new AssetsManager();
                        console.log("--->>>> created class instance");
                        console.log(loader.addAudiox);
                    } catch (error) {
                        console.error(error);
                    }
                });
                
            
            
            /*
            loader.addImage
            loader.addTileMap
            loader.filesWaitingForUpload
            loader.preload
            loader.getAudio
            loader.getImage
            loader.getTileMap
            */
        });
    });

    describe('error handing', () => {
        it('should throw an error, if file extension is not supported', (done) => {

        });

        it('should throw an error, if loading path is incorrect', (done) => {

        })
    })
});
