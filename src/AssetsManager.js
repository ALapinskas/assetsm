
const PROGRESS_EVENT_TYPE = {
    loadstart: "loadstart", 
    progress: "progress", 
    abort: "abort", 
    error: "error", 
    load: "load", 
    timeout: "timeout"
}

/**
 *  This class is used to preload 
 *  tilemaps, tilesets, images and audio,
 *  and easy access loaded files by keys
 */
export default class AssetsManager {

    /**
     * @type {EventTarget}
     */
    #emitter;

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

    constructor() {
        this.#audio = new Map();
        this.#images = new Map();
        this.#tilemaps = new Map();
        this.#audioQueue = [];
        this.#imagesQueue = [];
        this.#tileMapsQueue = [];
        this.#emitter = new EventTarget();
    }

    /**
     * @param {String} key 
     * @returns {HTMLAudioElement | undefined} cloned audio element
     */
    getAudio(key) {
        const val = this.#audio.get(key);
        if (val) {
            return val;
        } else {
            Warning("Audio with key '" + key + "' is not loaded");
        }
    }

    /**
     * @param {String} key 
     * @returns {ImageBitmap | undefined}
     */
    getImage(key) {
        const val = this.#images.get(key);
        if (val) {
            return val;
        } else {
            Warning("Image with key '" + key + "' is not loaded");
        }
    }

    /**
     * @param {String} key 
     * @returns {Object | undefined}
     */
    getTileMap(key) {
        const val = this.#tilemaps.get(key);
        if (val) {
            return val;
        } else {
            Warning("Tilemap with key '" + key + "' is not loaded");
        }
    }

    /**
     * Execute load audio, images from tilemaps and images queues
     * @returns {Promise}
     */
    preload() {
        let total = this.#audioQueue.length + this.#tileMapsQueue.length + this.#imagesQueue.length;
        this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.loadstart, { total }));
        
        return Promise.allSettled(this.#audioQueue.map(promise => promise())).then((loadingResults) => {
            loadingResults.forEach((result) => {
                if (result.status === "rejected") {
                    Warning(result.reason || result.value);
                }
            });

            let loadedAudio = this.#audioQueue.length;
            if (loadedAudio > 0) {
                total = total - loadedAudio;
                this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.progress, { lengthComputable: true, loaded: loadedAudio, total }));
            }

            //clear load queue
            this.#audioQueue = [];

            return Promise.allSettled(this.#tileMapsQueue.map(promise => promise())).then((loadingResults) => {
                loadingResults.forEach((result) => {
                    if (result.status === "rejected") {
                        Warning(result.reason || result.value);
                    }
                }); 
                
                let loadedTileMaps = this.#tileMapsQueue.length;
                if (loadedTileMaps > 0) {
                    let loaded = loadedTileMaps + loadedAudio;
                    total = this.#imagesQueue.length;
                    this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.progress, { lengthComputable: true, loaded, total }));
                }

                //clear load queue
                this.#tileMapsQueue = [];

                return Promise.allSettled(this.#imagesQueue.map(promise => promise())).then((loadingResults) => { 
                    loadingResults.forEach((result) => {
                        if (result.status === "rejected") {
                            Warning(result.reason || result.value);
                        }
                    });

                    let loadedImages = this.#imagesQueue.length;
                    if (loadedImages > 0) {
                        let loaded = loadedAudio + loadedTileMaps + loadedImages;
                        this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.progress, { lengthComputable: true, loaded, total: 0 }));
                    }

                    this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.load));
                    //clear load queue
                    this.#imagesQueue = [];

                    return Promise.resolve();
                });
            });
        });
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
        const promise = () => (
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
            })
        );
        this.#tileMapsQueue.push(promise);
    }

    addEventListener(type, fn, ...args) {
        if (!PROGRESS_EVENT_TYPE[type]) {
            Warning("Event type should be one of the ProgressEvent.type");
        } else {
            this.#emitter.addEventListener(type, fn, ...args);
        }   
    }

    removeEventListener(type, fn, ...args) {
        this.#emitter.removeEventListener(type, fn, ...args);
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
        return () => (new Promise((resolve, reject) => {
            const audio = new Audio(url);
            
            audio.addEventListener("loadeddata", () => {
                this.#addNewAudio(key, audio);
                resolve();
            });

            audio.addEventListener("error", (err) => {
                reject(err);
            });
        }));
    }

    /**
     * Loads image file
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise}
     */
    #loadImage(key, url) {
        return () => (new Promise((resolve, reject) => {
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
        }));
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