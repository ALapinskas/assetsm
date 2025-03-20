
const PROGRESS_EVENT_TYPE = {
    loadstart: "loadstart", 
    progress: "progress", 
    abort: "abort", 
    error: "error", 
    load: "load", 
    timeout: "timeout"
}

const ERROR_MESSAGES = {
    // Critical
    LOADER_NOT_REGISTERED: " loader is not registered.",
    RECURSION_ERROR: "Too much recursion. Stop iteration.",
    NOT_CORRECT_METHOD_TYPE: "uploadMethod should be instance of Promise and return upload result value",
    XML_FILE_EXTENSION_INCORRECT: " AtlasXML file extension is incorrect, only .xml file supported",
    TILESET_FILE_EXTENSION_INCORRECT: " tileset file extension is not correct, only .tsj, .json, .tsx, .xml files are supported",
    TILEMAP_FILE_EXTENSION_INCORRECT: " tilemap file extension is not correct, only .tmj, .json, .tmx, .xml files are supported",
    INPUT_PARAMS_ARE_INCORRECT: " fileKey and url should be provided",
    // Non critical
    ATLAS_IMAGE_LOADING_FAILED: "Error loading atlas image ",
    TILESET_LOADING_FAILED: "Error loading related tileset ",
    TILEMAP_LOADING_FAILED: "Error loading tilemap ",
    AUDIO_LOADING_FAILED: "Error loading audio ",
    IMAGE_LOADING_FAILED: "Error loading image ",
    XML_FORMAT_INCORRECT: " XML format is not correct.",
}

const FILE_FORMAT = {
    JSON: "JSON",
    XML: "XML",
    UNKNOWN: "UNKNOWN"
}

class Loader {
    /**
     * @type {string}
     */
    #fileType;
    /**
     * @type { (...args: any[]) => Promise<void> }
     */
    #uploadMethod;
    /**
     * name: url
     * @type { Map<string, string[]>}
     */
    #loadingQueue = new Map();
    /**
     * name: file
     * @type { Map<string, any>}
     */
    #store = new Map();
    /**
     * 
     * @param {string} name 
     * @param {Function} uploadMethod 
     */

    constructor(name, uploadMethod) {
        this.#fileType = name;
        this.#uploadMethod = (key, url, ...args) => {
            const upload = uploadMethod(key, url, ...args);
            if (upload instanceof Promise) {
                return upload.then((uploadResult) => this.#processUploadResult(uploadResult, key));
            } else {
                throw new TypeError(ERROR_MESSAGES.NOT_CORRECT_METHOD_TYPE);
            }
        }
    }

    /**
     * 
     * @param {null | Object} uploadResult 
     * @param {string} key 
     * @returns {Promise<void>}
     */
    #processUploadResult = (uploadResult, key) => {
        return new Promise((resolve, reject) => {
            if ( !uploadResult && uploadResult !== null ) {
                Warning("AssetsManager: uploadMethod for " + this.#fileType + " returns incorrect value");
            }
            this.#addUploadResultValue(key, uploadResult);
            this.#removeUploadFromQueue(key);
            resolve();
        });
    }

    /**
     * 
     * @param {string} key 
     * @param {*} value 
     */
    #addUploadResultValue(key, value) {
        this.#store.set(key, value);
    }

    /**
     * 
     * @param {string} key 
     */
    #removeUploadFromQueue(key) {
        this.#loadingQueue.delete(key);
    }

    get filesWaitingForUpload() {
        return this.#loadingQueue.size;
    }

    get loadingQueue() {
        return this.#loadingQueue
    };
    
    get uploadMethod() { 
        return this.#uploadMethod;
    }

    /**
     * 
     * @param {string} key 
     * @param {string[]} paramsArr 
     */
    _addFile = (key, paramsArr) => {
        if (this.#loadingQueue.has(key)) {
            Warning("AssetsManager: File " + this.#fileType + " with key " + key + " is already added");
        }
        this.#loadingQueue.set(key, paramsArr);
    }

    /**
     * 
     * @param {string} key 
     * @returns {boolean}
     */
    _isFileInQueue = (key) => {
        return this.#loadingQueue.has(key);
    }

    /**
     * 
     * @param {string} key 
     * @returns {any}
     */
    _getFile = (key) => {
        return this.#store.get(key);
    }
}

/**
 *  This class is used to preload 
 *  tilemaps, tilesets, images and audio,
 *  and easy access loaded files by keys
 */
export default class AssetsManager {

    /**
     * @type {number}
     */
    #MAX_LOADING_CYCLES = 5;
    /**
     * @type {EventTarget}
     */
    #emitter = new EventTarget();

    /**
     * @type { Map<string, Loader>}
     */
    #registeredLoaders = new Map();
    
    /**
     * @type {number}
     */
    #itemsLoaded = 0;

    constructor() {
        this.registerLoader("Audio", this._loadAudio);
        this.registerLoader("Image", this._loadImage);
        this.registerLoader("TileMap", this._loadTileMap);
        this.registerLoader("TileSet", this._loadTileSet);
        this.registerLoader("AtlasImageMap", this._loadAtlasImage);
        this.registerLoader("AtlasXML", this._loadAtlasXml);
    }

    /**
     * @returns {number}
     */
    get filesWaitingForUpload() {
        let files = 0;
        Array.from(this.#registeredLoaders.values()).map((loader) => files += loader.filesWaitingForUpload);
        return files;
    }

    /**
     * Register a new file type to upload. Method will dynamically add new methods.
     * @param {string} fileTypeName
     * @param {Function=} loadMethod loadMethod should return Promise<result>
     * @returns {void}
     */
    registerLoader = (fileTypeName, loadMethod = this._defaultUploadMethod) => {
        this["add" + fileTypeName] = (key, url, ...args) => {
            this.addFile(fileTypeName, key, url, ...args);
        }
        this["get" + fileTypeName] = (key) => {
            return this.getFile(fileTypeName, key);
        }
        this["is" + fileTypeName + ["InQueue"]] = (key) => {
            return this.isFileInQueue(fileTypeName, key);
        }

        const registeredFileType = this.#registeredLoaders.get(fileTypeName) || new Loader(fileTypeName, loadMethod);

        this.#registeredLoaders.set(fileTypeName, registeredFileType);
    }

    /**
     * Execute load audio, images from tilemaps and images queues
     * @returns {Promise<void>}
     */
    preload() {
        this.#dispatchLoadingStart();
        return new Promise(async(resolve, reject) => {
            this.#uploadFilesRecursive().then(() => {
                this.#dispatchLoadingFinish();
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * 
     * @param {number} loadCount 
     * @returns {Promise<void>}
     */
    #uploadFilesRecursive(loadCount = 0) {
        return this.#uploadFiles().then(() => {
            if (this.filesWaitingForUpload === 0) {
                return Promise.resolve();
            } else {
                loadCount++;
                if (loadCount > this.#MAX_LOADING_CYCLES) {
                    const err = new Error(ERROR_MESSAGES.RECURSION_ERROR);
                    this.#dispatchLoadingError(err);
                    return Promise.reject(new Error(ERROR_MESSAGES.RECURSION_ERROR));
                } else {
                    return this.#uploadFilesRecursive(loadCount);
                }
            }
        });
    }

    /**
     * 
     * @returns {Promise<void>}
     */
    #uploadFiles() {
        return new Promise((resolve, reject) => {
            /** @type {Promise<void>[]} */
            let uploadPromises = [];
            Array.from(this.#registeredLoaders.values()).forEach((fileType) => {
                Array.from(fileType.loadingQueue.entries()).forEach((key_value) => {
                    /** @type {Promise<void>} */
                    const p = new Promise((res, rej) => fileType.uploadMethod(key_value[0], ...key_value[1]).then(() => res()));
                    uploadPromises.push(p);
                });
            });
    
            Promise.allSettled(uploadPromises).then((results) => {
                for (const result of results) {
                    if (result.status === "rejected") {
                        const error = result.reason;
                        // incorrect method is a critical issue
                        if (this.#isUploadErrorCritical(error)) {
                            reject(error);
                        } else {
                            Warning("AssetsManager: " + error.message);
                            this.#dispatchLoadingError(error);
                        }
                    }
                }
                resolve();
            });
        });
    }

    addEventListener(type, fn, ...args) {
        if (!PROGRESS_EVENT_TYPE[type]) {
            Warning("AssetsManager: Event type should be one of the ProgressEvent.type");
        } else {
            this.#emitter.addEventListener(type, fn, ...args);
        }   
    }

    removeEventListener(type, fn, ...args) {
        this.#emitter.removeEventListener(type, fn, ...args);
    }

    /**
     * Loads image atlas xml
     * @param {string} key
     * @param {string} url
     * @returns {Promise<HTMLElement | Error>}
     */
    _loadAtlasXml = (key, url) => {
        this.#checkXmlUrl(url);
        return fetch(url)
            .then(response => response.text())
            .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
            .then(data => {
                const atlas = data.documentElement || data.activeElement,
                    atlasImagePath = atlas.attributes.getNamedItem("imagePath"),
                    childrenNodes = atlas.children;

                if (atlasImagePath) {
                    const relativePath = this.#calculateRelativePath(url);

                    this.addAtlasImageMap(key, relativePath + atlasImagePath.value, childrenNodes, relativePath);
                    return atlas;
                } else {
                    const err = new Error(key + ERROR_MESSAGES.XML_FORMAT_INCORRECT);
                    this.#dispatchLoadingError(err);
                    return err;
                    // return Promise.reject(err);
                }
            });
    }

    _loadAtlasImage = (key, url, atlasChildNodes, cors = "anonymous") => {
        return new Promise((resolve, reject) => {
            const img = new Image(),
                imageAtlas = new Map(),
                tempCanvas = document.createElement("canvas"),
                tempCtx = tempCanvas.getContext("2d");
            
            img.crossOrigin = cors;
            img.onload = () => {
                const imageBitmapPromises = [];
                let imageAtlasKeys = [];
                // fix dimensions
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);

                for(let childNode of atlasChildNodes) {
                    const nodeAttr = childNode.attributes,
                        fullName = nodeAttr.getNamedItem("name").value,
                        name = fullName.includes(".") ? fullName.split(".")[0] : fullName, // remove name ext
                        x = nodeAttr.getNamedItem("x").value,
                        y = nodeAttr.getNamedItem("y").value,
                        width = nodeAttr.getNamedItem("width").value,
                        height = nodeAttr.getNamedItem("height").value;
                    
                    // images are not cropped correctly in the mozilla@124.0, issue:
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1797567
                    // getImageData() crop them manually before 
                    // creating imageBitmap from atlas
                    imageBitmapPromises.push(createImageBitmap(tempCtx.getImageData(x, y, width, height), {premultiplyAlpha:"premultiply"}));
                    imageAtlasKeys.push(name);
                }
                this.#dispatchCurrentLoadingProgress();
                Promise.all(imageBitmapPromises).then((results) => {
                    results.forEach((image, idx) => {
                        const name = imageAtlasKeys[idx];
                        imageAtlas.set(name, image);
                        this.addImage(name, "empty url", image);
                    });
                    tempCanvas.remove();
                    resolve(imageAtlas);
                });
            };
            img.onerror = () => {
                const err = new Error(ERROR_MESSAGES.ATLAS_IMAGE_LOADING_FAILED + url);
                this.#dispatchLoadingError(err);
                resolve(null);
                //reject(err);
            };
            img.src = url;
        });
    }

    /**
     * Loads tileset
     * @param {string} key
     * @param {string} url 
     * @param {number} gid
     * @param {string} relativePath
     * @returns {Promise<Object>}
     */
    _loadTileSet = (key, url, gid=1, relativePath) => {
        const file_format = this.#checkTilesetUrl(url),
            loadPath = relativePath ? relativePath + url : url;
        if (file_format === FILE_FORMAT.JSON) {
            return fetch(loadPath)
                .then((response) => response.json())
                .then((data) => this._processTilesetData(data, relativePath, gid, url))
                .catch(() => {
                    const err = new Error(ERROR_MESSAGES.TILESET_LOADING_FAILED + url);
                    this.#dispatchLoadingError(err);
                    return Promise.resolve(null);
                    //return Promise.reject(err);
                });
        } else if (file_format === FILE_FORMAT.XML) {
            return fetch(loadPath)
                .then(response => response.text())
                .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
                .then(xmlString => this._processTilesetXmlData(xmlString.documentElement))
                .then((data) => this._processTilesetData(data, relativePath, gid, url))
                .catch(() => {
                    const err = new Error(ERROR_MESSAGES.TILESET_LOADING_FAILED + url);
                    this.#dispatchLoadingError(err);
                    return Promise.resolve(null);
                });
        } else {
            return Promise.reject(loadPath + ERROR_MESSAGES.TILEMAP_FILE_EXTENSION_INCORRECT);
        }
    }

    /**
     * 
     * @param {Object} doc 
     * @returns {Object}
     */
    _processTilesetXmlData = (doc) => {
        const tilesetData = {
            columns: Number(doc.attributes?.columns?.value),
            name: doc.attributes?.name?.value,
            tilecount: Number(doc.attributes?.tilecount?.value),
            tiledversion: doc.attributes?.tiledversion?.value,
            tileheight: Number(doc.attributes?.tileheight?.value),
            tilewidth: Number(doc.attributes?.tilewidth?.value),
            version: doc.attributes?.version?.value,
            margin: doc.attributes?.margin ? Number(doc.attributes.margin.value) : 0,
            spacing: doc.attributes?.spacing ? Number(doc.attributes.margin.value) : 0,
            type: doc.tagName
        };
        
        this._processTilesetXmlChildData(tilesetData, doc.childNodes);
        
        return tilesetData;
    }

    /**
     * 
     * @param {any} tilesetData 
     * @param {any} nodes
     * @returns {void} 
     */
    _processTilesetXmlChildData(tilesetData, nodes) {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i],
                name = node.nodeName;
                
            if (name === "image") {
                tilesetData.image = node?.attributes?.source?.value;
                tilesetData.imagewidth = node?.attributes?.width ? Number(node.attributes.width.value) : 0;
                tilesetData.imageheight = node?.attributes?.height ? Number(node.attributes.height.value) : 0;
            } else if (name === "tileoffset") {
                tilesetData.tileoffset = {
                    x: Number(node.attributes.x.value),
                    y: Number(node.attributes.y.value)
                };
            } else if (name === "tile") {
                if (!tilesetData.tiles) {
                    tilesetData.tiles = [];
                }
                //add boundaries / animations
                const tile = {
                    id: Number(node.attributes?.id?.value)
                }
                const childN = node.childNodes;
                
                for (let j = 0; j < childN.length; j++) {
                    const child = childN[j],
                        childName = child.nodeName;
                    if (childName === "objectgroup") {
                        tile.objectgroup = {
                            type: childName
                        }

                        if (child.attributes?.id) {
                            tile.objectgroup.id = Number(child.attributes?.id?.value);
                        }
                        if (child.attributes?.draworder) {
                            tile.objectgroup.draworder = child.attributes.draworder.value;
                        }
                        if (child.attributes?.opacity) {
                            tile.objectgroup.opacity = child.attributes.opacity.value;
                        }
                        if (child.attributes?.x && child.attributes?.y) {
                            tile.objectgroup.x = child.attributes.x.value;
                            tile.objectgroup.y = child.attributes.y.value;
                        }

                        tile.objectgroup.objects = [];

                        const objects = child.childNodes;
                        for (let k = 0; k < objects.length; k++) {
                            const obj = objects[k];
                            
                            if (obj.nodeName === "object") {
                                const objInc = {
                                    id: Number(obj.attributes?.id?.value),
                                    visible: obj.attributes.visible && obj.attributes.visible.value === "0" ? false : true,
                                    x: Number(obj.attributes?.x?.value),
                                    y: Number(obj.attributes?.y?.value),
                                    rotation: obj.attributes?.rotation ? Number(obj.attributes.rotation.value) :0,
                                };
                                if (obj.attributes?.width) {
                                    objInc.width = Number(obj.attributes.width.value); 
                                }
                                if (obj.attributes?.height) {
                                    objInc.height = Number(obj.attributes.height.value);
                                }
                                
                                const childObjects = obj.childNodes;
                                if (childObjects && childObjects.length > 0) {
                                    for (let n = 0; n < childObjects.length; n++) {
                                        const childObj = childObjects[n];
                                
                                        if (childObj.nodeName === "ellipse") {
                                            objInc.ellipse = true;
                                        } else if (childObj.nodeName === "point") {
                                            objInc.point = true;
                                        } else if (childObj.nodeName === "polygon") {
                                            const points = childObj.attributes?.points?.value;
                                            if (points && points.length > 0) {
                                                const pointsArr = points.split(" ").map((point) => {
                                                    const [x, y] = point.split(",");
                                                    return {x:Number(x), y:Number(y)};
                                                });
                                                objInc.polygon = pointsArr;
                                            }
                                        }
                                    }
                                }

                                tile.objectgroup.objects.push(objInc);
                            }
                        }
                    } else if (childName === "animation") {
                        //
                        tile.animation = [];
                        
                        const frames = child.childNodes;
                        for (let t = 0; t < frames.length; t++) {
                            const frame = frames[t];

                            if (frame.nodeName === "frame") {
                                const frameObject = {
                                    tileid: Number(frame.attributes?.tileid?.value),
                                    duration: Number(frame.attributes?.duration?.value)
                                }
                                tile.animation.push(frameObject);
                            }
                        }
                    }
                }

                tilesetData.tiles.push(tile);
            }
        }
    }
    /**
     * 
     * @param {Object} data 
     * @param {string} relativePath
     * @param {number=} gid
     * @param {string=} source
     * @returns {Promise<Object>}
     */
    _processTilesetData = (data, relativePath, gid, source) => {
        const {name, image } = data;
        if (name && image && !this.isFileInQueue("Image", name)) {
            this.addImage(name, relativePath ? relativePath + image : image);
        }
        if (gid) {
            data.firstgid = gid;
        }
        // if it is an external file
        if (source) {
            data.source = source;
        }
        return Promise.resolve(data);
    }

    /**
     * 
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise<any>}
     */
    _defaultUploadMethod = (key, url) => {
        return fetch(url);
    }

    /**
     * Loads tilemap file and related data
     * @param {string} key 
     * @param {string} url 
     * @param {boolean} [attachTileSetData = true] - indicates, whenever tilesetData is attached, or will be loaded separately
     * @returns {Promise}
     */
    _loadTileMap = (key, url, attachTileSetData = true) => {
        const file_format = this.#checkTilemapUrl(url);
        
        let fetchData;
        if (file_format === FILE_FORMAT.JSON) {
            fetchData = fetch(url)
                .then((response) => response.json())
                .then((data) => this._processTileMapData(data, url, attachTileSetData))
                .catch((err) => {
                    if (err.message.includes("JSON.parse:")) {
                        err = new Error(ERROR_MESSAGES.TILEMAP_LOADING_FAILED + url);
                    }
                    this.#dispatchLoadingError(err);
                    return Promise.resolve(null);
                    //return Promise.reject(err);
                });
        } else if (FILE_FORMAT.XML) {
            fetchData = fetch(url)
                .then((response) => response.text())
                .then((rawText) => this._processTileMapXML(rawText))
                .then((tilemapData) => this._processTileMapData(tilemapData, url, attachTileSetData))
                .catch((err) => {
                    this.#dispatchLoadingError(err);
                    return Promise.resolve(null);
                    //return Promise.reject(err);
                });
        } else {
            return Promise.reject(url + ERROR_MESSAGES.TILEMAP_FILE_EXTENSION_INCORRECT);
        }

        return fetchData;
    }

    /**
     * 
     * @param {string} rawText 
     * @returns {Object}
     */
    _processTileMapXML = (rawText) => {
        const xmlDoc = new DOMParser().parseFromString(rawText, "text/xml");
                
        /** @type {Object} */
        const doc = xmlDoc.documentElement;
        const tilemapData = {
            type: doc.tagName,
            width: Number(doc.attributes?.width?.value),
            height: Number(doc.attributes?.height?.value),
            infinite: doc.attributes.infinite && doc.attributes.infinite.value === "1" ? true : false,
            nextlayerid: Number(doc.attributes?.nextlayerid?.value),
            nextobjectid: Number(doc.attributes?.nextobjectid?.value),
            orientation: doc.attributes?.orientation?.value,
            renderorder: doc.attributes?.renderorder?.value,
            tiledversion: doc.attributes?.tiledversion?.value,
            tileheight: Number(doc.attributes?.tileheight?.value),
            tilewidth: Number(doc.attributes?.tilewidth?.value),
            version: doc.attributes?.version?.value,
            /** @type {Array<Object>} */
            tilesets: [],
            /** @type {Array<Object>} */
            layers: []
        };
        const nodes = xmlDoc.documentElement.childNodes;
        for (let i = 0; i < nodes.length; i++) {
            /** @type {Object} */
            const node = nodes[i],
                name = node.nodeName;
                
            if (name === "tileset") {
                const tileset = {
                    firstgid: Number(node.attributes?.firstgid?.value)
                };
                if (node.attributes?.source) { // external tileset (will be loaded later)
                    tileset.source = node.attributes?.source?.value;
                } else {
                    // inline tileset
                    tileset.columns = Number(node.attributes?.columns?.value);
                    if (node.attributes?.margin) {
                        tileset.margin = Number(node.attributes?.margin?.value);
                    }
                    if (node.attributes?.spacing) {
                        tileset.spacing = node.attributes?.spacing?.value;
                    }
                    tileset.name = node.attributes?.name?.value;
                    
                    tileset.tilecount = Number(node.attributes?.tilecount?.value);
                    tileset.tilewidth = Number(node.attributes?.tilewidth?.value);
                    tileset.tileheight = Number(node.attributes?.tileheight?.value);

                    this._processTilesetXmlChildData(tileset, node.childNodes);
                }
                tilemapData.tilesets.push(tileset);
            } else if (name === "layer") {
                const layer = {
                    height: Number(node.attributes?.height?.value),
                    id: Number(node.attributes?.id?.value),
                    name: node.attributes?.name?.value,
                    width: Number(node.attributes?.width?.value),
                    data: node.textContent ? node.textContent.trim().split(",").map((val) => Number(val)): null
                }
                tilemapData.layers.push(layer);
            }
        }

        return tilemapData;
    }

    /**
     * 
     * @param {any} data 
     * @param {string} url 
     * @param {boolean} attachTileSetData 
     * @returns {Promise<any>}
     */
    _processTileMapData = (data, url, attachTileSetData) => {
        const relativePath = this.#calculateRelativePath(url);
        
        if (attachTileSetData === true && data.tilesets && data.tilesets.length > 0) {
            const tilesetPromises = [];
            // upload additional tileset data
            data.tilesets.forEach((tileset, idx) => {
                const { firstgid, source } = tileset;
                if (source) { // external tileset
                    const loadTilesetPromise = this._loadTileSet("default-" + firstgid, source, firstgid, relativePath)
                        .then((tilesetData) => {
                            this.#dispatchCurrentLoadingProgress();
                            return Promise.resolve(tilesetData);
                        });
                    tilesetPromises.push(loadTilesetPromise);
                } else { // inline tileset
                    const loadTilesetPromise = this._processTilesetData(tileset, relativePath)
                        .then((tilesetData) => {
                            this.#dispatchCurrentLoadingProgress();
                            return Promise.resolve(tilesetData);
                        });
                    tilesetPromises.push(loadTilesetPromise);
                }
            });
            //attach additional tileset data to tilemap data
            return Promise.all(tilesetPromises).then((tilesetDataArray) => {
                for (let i = 0; i < tilesetDataArray.length; i++) {
                    const tilesetData = tilesetDataArray[i];
                    data.tilesets[i] = tilesetData;
                    // @depricated
                    // save backward capability with jsge@1.5.71
                    data.tilesets[i].data = Object.assign({}, tilesetData);
                }
                return Promise.resolve(data);
            });
        } else {
            return Promise.resolve(data);
        }
    }

    /**
     * Loads audio file
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise}
     */
    _loadAudio = (key, url) => {
        return new Promise((resolve) => {
            const audio = new Audio(url);
            
            audio.addEventListener("loadeddata", () => {
                this.#dispatchCurrentLoadingProgress();
                resolve(audio);
            });

            audio.addEventListener("error", () => {
                const err = new Error(ERROR_MESSAGES.AUDIO_LOADING_FAILED + url);
                this.#dispatchLoadingError(err);
                resolve(null);
                //reject(err);
            });
        });
    }

    /**
     * Loads image file.
     * @param {string} key 
     * @param {string} url
     * @param {ImageBitmap=} image - image could be add from another source
     * @param {string} [cors="anonymous"] // https://hacks.mozilla.org/2011/11/using-cors-to-load-webgl-textures-from-cross-domain-images
     * @returns {Promise}
     */
    _loadImage = (key, url, image, cors = "anonymous") => {
        return new Promise((resolve, reject) => {
            if (image) {
                resolve(image);
            } else {
                const img = new Image();
                img.crossOrigin = cors;
                img.onload = () => {
                    // do we need a bitmap? Without creating bitmap images has not premultiplied
                    // transparent pixels, and in some cases it creates white ages,
                    // in other - multiply pixels with the background
                    createImageBitmap(img, {premultiplyAlpha:"premultiply"}).then((imageBitmap) => {
                        this.#dispatchCurrentLoadingProgress();
                        resolve(imageBitmap);
                    });
                };
                img.onerror = () => {
                    const err = new Error(ERROR_MESSAGES.IMAGE_LOADING_FAILED + url);
                    this.#dispatchLoadingError(err);
                    resolve(null);
                    // reject(err);
                };
                img.src = url;
            }
        });
    }

    #checkXmlUrl(url) {
        if (url.includes(".xml")) {
            return;
        } else {
            Exception(url + ERROR_MESSAGES.XML_FILE_EXTENSION_INCORRECT);
        }
    }

    #checkTilesetUrl(url) {
        if (url.includes(".tsj") || url.includes(".json")) {
            return FILE_FORMAT.JSON;
        } else if (url.includes(".tsx") || url.includes(".xml")) {
            return FILE_FORMAT.XML;
        } else {
            return FILE_FORMAT.UNKNOWN;
        }
    }

    #checkTilemapUrl(url) {
        if (url.includes(".tmj") || url.includes(".json")) {
            return FILE_FORMAT.JSON;
        } else if (url.includes(".tmx") || url.includes(".xml")) {
            return FILE_FORMAT.XML;
        } else {
            return FILE_FORMAT.UNKNOWN;
        }
    }

    #isUploadErrorCritical(error) {
        return error.message.includes(ERROR_MESSAGES.NOT_CORRECT_METHOD_TYPE)
            || error.message.includes(ERROR_MESSAGES.XML_FILE_EXTENSION_INCORRECT)
            || error.message.includes(ERROR_MESSAGES.TILESET_FILE_EXTENSION_INCORRECT)
            || error.message.includes(ERROR_MESSAGES.TILEMAP_FILE_EXTENSION_INCORRECT)
            || error.message.includes(ERROR_MESSAGES.INPUT_PARAMS_ARE_INCORRECT)
            || error.message.includes(ERROR_MESSAGES.LOADER_NOT_REGISTERED);
    }

    /**
     * Calculate relative path for current url
     * for example: /folder/images/map.xml -> /folder/images/
     * @param {string} url 
     * @returns {string}
     */
    #calculateRelativePath(url) {
        let split = url.split("/"),
            length = split.length,
            lastEl = split[length - 1],
            //prelastEl = split[length - 2],
            relativePath = "/";
        
        // url ends with .ext
        if (lastEl.includes(".tmj") || lastEl.includes(".tmx") || lastEl.includes(".xml") || lastEl.includes(".json")) {
            split.pop();
            relativePath = split.join("/") + "/";
        // url ends with /
        }/* else if (prelastEl.includes(".tmj") || lastEl.includes(".tmx") || prelastEl.includes(".xml") || prelastEl.includes(".json")) {
            split.splice(length - 2, 2);
            relativePath = split.join("/") + "/";
        }*/
        return relativePath;
    }

    addFile(fileType, fileKey, url, ...args) {
        const loader = this.#registeredLoaders.get(fileType);
        if (loader) {
            this.#checkInputParams(fileKey, url, fileType);
            loader._addFile(fileKey, [url, ...args]);
        } else {
            Exception(fileType + ERROR_MESSAGES.LOADER_NOT_REGISTERED);
        }

    }

    isFileInQueue(fileType, fileKey) {
        const loader = this.#registeredLoaders.get(fileType);
        if (loader) {
            return loader._isFileInQueue(fileKey);
        } else {
            Exception("Loader for " + fileType + " is not registered!");
        }
    }

    getFile(fileType, fileKey) {
        const loader = this.#registeredLoaders.get(fileType);
        if (loader) {
            return loader._getFile(fileKey);
        } else {
            Exception("Loader for " + fileType + " is not registered!");
        }
    }

    #checkInputParams(fileKey, url, fileType) {
        const errorMessage = ERROR_MESSAGES.INPUT_PARAMS_ARE_INCORRECT;
        if (!fileKey || fileKey.trim().length === 0) {
            Exception("add" + fileType + "()" + errorMessage);
        }
        if (!url || url.trim().length === 0) {
            Exception("add" + fileType + "()" + errorMessage);
        }
        return;
    }

    #dispatchLoadingStart() {
        let total = this.filesWaitingForUpload;
        this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.loadstart, { total }));
    }

    #dispatchLoadingFinish() {
        this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.load));
    }

    #dispatchCurrentLoadingProgress() {
        const total = this.filesWaitingForUpload;
        this.#itemsLoaded += 1;
        this.#emitter.dispatchEvent(new ProgressEvent(PROGRESS_EVENT_TYPE.progress, { lengthComputable: true, loaded: this.#itemsLoaded, total }));
    }

    #dispatchLoadingError(error) {
        Warning("AssetsManger: " + error.message);
        this.#emitter.dispatchEvent(new ErrorEvent(PROGRESS_EVENT_TYPE.error, { error }));
    }
}

function Exception (message) {
    throw new Error(message);
}

function Warning (message) {
    console.warn(message);
}