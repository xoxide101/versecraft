// RealmCraft's libraries in one plain script (works from file://, no modules): window.THREE
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = Object.assign({}, T, { GLTFLoader, BufferGeometryUtils });
