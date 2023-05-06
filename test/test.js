import assert from 'assert';
import puppeteer from 'puppeteer';
import AssetsManager from '../src/AssetsManager.js';

let browser, page;

global.EventTarget = class EventTarget {};

describe('Assets Manager module testing', function () {
    before(() => {
    });

    after(() => {
    });

    describe('adding, loading, retrieving', () => {
        it('should create an instance of AssetsManager, module methods should be available', (done) => {
            try {
                const loader = new AssetsManager();
                assert.equal(typeof loader.addAudio, "function");
                assert.equal(typeof loader.addImage, "function");
                assert.equal(typeof loader.addTileMap, "function");
                assert.equal(typeof loader.filesWaitingForUpload, "number");
                assert.equal(typeof loader.preload, "function");
                assert.equal(typeof loader.getAudio, "function");
                assert.equal(typeof loader.getImage, "function");
                assert.equal(typeof loader.getTileMap, "function");
                done();
            } catch (err) {
                console.error(err);
                done(err);
            }
        });
    });

    describe('error handing', () => {
        it('should throw an error, if file extension is not supported', (done) => {

        });

        it('should throw an error, if loading path is incorrect', (done) => {

        })
    })
});
