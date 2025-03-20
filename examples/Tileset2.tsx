<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="Tileset" tilewidth="16" tileheight="16" tilecount="16" columns="4">
 <tileoffset x="5" y="5"/>
 <image source="Tileset.png" width="64" height="64"/>
 <tile id="0">
  <objectgroup draworder="index">
   <object id="2" x="0.666667" y="1.66667" width="14" height="12"/>
  </objectgroup>
 </tile>
 <tile id="1">
  <objectgroup draworder="index">
   <object id="2" x="1.33333" y="-0.333333" width="13.3333" height="13">
    <ellipse/>
   </object>
  </objectgroup>
  <animation>
   <frame tileid="0" duration="150"/>
   <frame tileid="1" duration="150"/>
   <frame tileid="2" duration="150"/>
  </animation>
 </tile>
 <tile id="2">
  <objectgroup draworder="index">
   <object id="1" x="14" y="2.66667">
    <polygon points="0,0 -11.3333,-2.33333 -13.3333,1.66667 -12,10 -6.66667,11.6667 2,9.66667"/>
   </object>
  </objectgroup>
 </tile>
 <tile id="3">
  <objectgroup draworder="index" id="2">
   <object id="1" x="3" y="8">
    <point/>
   </object>
  </objectgroup>
 </tile>
</tileset>
