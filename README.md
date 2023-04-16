# assetsm
Assets Manager.
Tilemaps(.tmj/.json), images and audio files loading and managing.

# How to use
1. Install module
```
npm i assetsm
```
2. Import and create a class instance
```
import AssetsManager from "assetsm"

const assets = new AssetsManager()
```
3. Register files
```
assets.addAudio(key, url)
assets.addImage(key, url)
assets.addTileMap(key, url)
```
4. Preload all files you registered in the previous step
```
assets.preload().then(() => {
```
5. Use files
```
{
    const audio = assets.getAudio(key)
    const image = assets.getImage(key)
    const tilemap = assets.getTileMap(key)
}
```
6. To check the process booleans you can use
```
assets.isLoading
assets.isAllFilesLoaded
```
# Run examples from ./examples folder
```
npm i --save-dev
npm start
```
# Other Notes

* Images are loaded as ImageBitmaps
* When loading tilemaps, it also process tileset files and loads images inside them, attached images could be retrieved by tileset.name key, check examples/index.js how to do that
* ES6 only
