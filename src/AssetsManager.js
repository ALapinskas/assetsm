/**
 *  This class is used to preload 
 *  tilemaps, tilesets, images and audio,
 *  and easy access loaded files by keys
 */
export default class AssetsManager {
    /**
     * @type {Map<String, HTMLAudioElement>}
     */
    #audio;

    /**
     * @type {Map<String, ImageBitmap>}
     */
    #images;

    /**
     * @type {Map<String, Object>}
     */
    #tilemaps;

    /**
     * @type {Array<Promise>}
     */
    #audioQueue;

    /**
     * @type {Array<Promise>}
     */
    #imagesQueue;

    /**
     * @type {Array<Promise>}
     */
    #tileMapsQueue;

    /**
     * @type {boolean}
     */
    #isLoading;

    /**
     * @type {boolean}
     */
    #isAllFilesLoaded;

    constructor() {
        this.#audio = new Map();
        this.#images = new Map();
        this.#tilemaps = new Map();
        this.#audioQueue = [];
        this.#imagesQueue = [];
        this.#tileMapsQueue = [];
        this.#isLoading = undefined;
        this.#isAllFilesLoaded = false;
    }

    /**
     * @param {String} key 
     * @returns {HTMLAudioElement} cloned audio element
     */
    getAudio(key) {
        const val = this.#audio.get(key);
        if (val) {
            return val;
        } else {
            Warning("Audio with key '" + key + "' is not registered");
        }
    }

    /**
     * @param {String} key 
     * @returns {ImageBitmap}
     */
    getImage(key) {
        const val = this.#images.get(key);
        if (val) {
            return val;
        } else {
            Warning("Image with key '" + key + "' is not registered");
        }
    }

    /**
     * @param {String} key 
     * @returns {Object}
     */
    getTileMap(key) {
        const val = this.#tilemaps.get(key);
        if (val) {
            return val;
        } else {
            Warning("Tilemap with key '" + key + "' is not registered");
        }
    }

    /**
     * Execute load audio, images from tilemaps and images queues
     * @returns {Promise}
     */
    preload() {
        this.#isLoading = true;
        return Promise.allSettled(this.#audioQueue).then((loadingResults) => {
            loadingResults.forEach((result) => {
                if (result.status === "rejected") {
                    Warning(result.reason || result.value);
                }
            });
            //clear load queue
            this.#audioQueue = [];
            return Promise.allSettled(this.#tileMapsQueue).then((loadingResults) => {
                loadingResults.forEach((result) => {
                    if (result.status === "rejected") {
                        Warning(result.reason || result.value);
                    }
                }); 
                //clear load queue
                this.#tileMapsQueue = [];
                return Promise.allSettled(this.#imagesQueue).then((loadingResults) => { 
                    loadingResults.forEach((result) => {
                        if (result.status === "rejected") {
                            Warning(result.reason || result.value);
                        }
                    });
                    //clear load queue
                    this.#imagesQueue = [];
                    this.#isAllFilesLoaded = true;
                    this.#isLoading = false;
                    return Promise.resolve();
                });
            });
        });
    }

    /**
     * @returns {boolean}
     */
    get isLoading() {
        return this.#isLoading;
    }

    /**
     * Indicates, whenever all files from queues are loaded or not
     * @returns {boolean}
     */
    get isAllFilesLoaded() {
        return this.#isAllFilesLoaded;
    }
    /**
     * Adds an audio file to a loading queue
     * @param {string} key 
     * @param {string} url
     */
    addAudio(key, url) {
        this.#checkInputParams(key, url);
        const promise = this.#loadAudio(key, url);
        this.#audioQueue.push(promise);
    }

    /**
     * Adds an image file to a loading queue
     * @param {string} key 
     * @param {string} url
     */
    addImage(key, url) {
        this.#checkInputParams(key, url);
        const promise = this.#loadImage(key, url);
        this.#imagesQueue.push(promise);
    }

    /**
     * Adds a tilemap, including tilesets and tilesets images to a loading queue
     * @param {String} key 
     * @param {String} url 
     */
    addTileMap(key, url) {
        this.#checkInputParams(key, url);
        const promise = 
            new Promise((resolve, reject) => {
                fetch(url)
                    .then((response) => response.json())
                    .then((data) => {
                        let split = url.split("/"),
                            length = split.length,
                            relativePath;
                        if (split[length - 1].includes(".tmj") || split[length - 1].includes(".json")) {
                            split.pop();
                            relativePath = split.join("/") + "/";
                        } else if (split[length - 2].includes(".tmj") || split[length - 2].includes(".json")) {
                            split.splice(length - 2, 2);
                            relativePath = split.join("/") + "/";
                        }
                        this.#addTileMap(key, data);
                        if (data.tilesets && data.tilesets.length > 0) {
                            data.tilesets.forEach((tileset, idx) => {
                                this.#loadTileSet(tileset, relativePath).then((tileset) => {
                                    this.#attachTilesetData(key, idx, tileset);
                                    resolve();
                                });
                            });
                        }
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        this.#tileMapsQueue.push(promise);
    }

    #loadTileSet(tileset, relativePath) {
        const { firstgid:gid, source:url } = tileset;
        return fetch("./" + relativePath ? relativePath + url : url)
            .then((response) => response.json())
            .then((data) => {
                const {name, image} = data;
                if (name && image) {
                    this.addImage(name, relativePath ? relativePath + image : image, data);
                }
                data.gid = gid;
                return Promise.resolve(data);
            }).catch((err) => {
                return Promise.reject(err);
            });
    }

    /**
     * Loads audio file
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise}
     */
    #loadAudio(key, url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            
            audio.addEventListener("loadeddata", () => {
                this.#addNewAudio(key, audio);
                resolve();
            });

            audio.addEventListener("error", (err) => {
                reject(err);
            });
        });
    }

    /**
     * Loads image file
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise}
     */
    #loadImage(key, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                createImageBitmap(img).then((imageBitmap) => {
                    this.#addNewImage(key, imageBitmap);
                    resolve();
                });
            };
            img.onerror = (err) => {
                reject(err);
            };
            img.src = url;
        });
    }

    #checkInputParams(key, url) {
        if (!key || key.trim().length === 0) {
            Exception("key should be provided");
        }
        if (!url || url.trim().length === 0) {
            Exception("image url should be provided");
        }
        return;
    }

    #addNewAudio(key, audio) {
        this.#audio.set(key, audio);
    }

    #addNewImage(key, image) {
        this.#images.set(key, image);
    }

    #attachTilesetData(key, idx, tileset) {
        const tilemap = this.#tilemaps.get(key);
        tilemap.tilesets[idx].data = tileset;
    }

    #addTileMap(key, data) {
        this.#tilemaps.set(key, data);
    }
}

function Exception (message) {
    throw new Error(message);
}

function Warning (message) {
    console.warn(message);
}