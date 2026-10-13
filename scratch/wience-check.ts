import { Quat } from '../A1_core/cad-math/quat.js';
import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { computeFaceData, localTo3D } from '../A4_smartpanel/native_core/face-lcs.js';

const W = 600; // szerokość szafki
const D = 560; // głębokość szafki (wysokość formatki wieńca)
const T = 18;

console.log('--- WIENIEC DOLNY (BOTTOM_PANEL) ---');
// Wieniec dolny: rotacja [90, 180, 0] deg, ściana wewnętrzna FACE_Z_PLUS
const qBottom = Quat.fromEulerXYZ(90 * Math.PI / 180, 180 * Math.PI / 180, 0);
const mBottom = Mat4.fromTRS(Vec3.ZERO, qBottom, Vec3.ONE);
const fdBottomPlus = computeFaceData('FACE_Z_PLUS', W, D, T);

const pBottom_V0 = localTo3D(fdBottomPlus, W / 2, 0);
const pBottom_V37 = localTo3D(fdBottomPlus, W / 2, 37);
const pBottom_V523 = localTo3D(fdBottomPlus, W / 2, 523);
const pBottom_V560 = localTo3D(fdBottomPlus, W / 2, 560);

const wBottom_V0 = mBottom.transformPoint(new Vec3(pBottom_V0[0], pBottom_V0[1], pBottom_V0[2]));
const wBottom_V37 = mBottom.transformPoint(new Vec3(pBottom_V37[0], pBottom_V37[1], pBottom_V37[2]));
const wBottom_V523 = mBottom.transformPoint(new Vec3(pBottom_V523[0], pBottom_V523[1], pBottom_V523[2]));
const wBottom_V560 = mBottom.transformPoint(new Vec3(pBottom_V560[0], pBottom_V560[1], pBottom_V560[2]));

console.log('V=0:   CAD Y =', wBottom_V0.y,   ' (CAD: -Y to przód -280, +Y to tył +280)');
console.log('V=37:  CAD Y =', wBottom_V37.y);
console.log('V=523: CAD Y =', wBottom_V523.y);
console.log('V=560: CAD Y =', wBottom_V560.y);

console.log('\n--- WIENIEC GÓRNY (TOP_PANEL) ---');
// Wieniec górny: rotacja [-90, 0, 0] deg
const qTop = Quat.fromEulerXYZ(-90 * Math.PI / 180, 0, 0);
const mTop = Mat4.fromTRS(Vec3.ZERO, qTop, Vec3.ONE);

console.log('1. Wieniec górny z FACE_Z_PLUS:');
const fdTopPlus = computeFaceData('FACE_Z_PLUS', W, D, T);
const pTopP_V0 = localTo3D(fdTopPlus, W / 2, 0);
const pTopP_V37 = localTo3D(fdTopPlus, W / 2, 37);
const pTopP_V523 = localTo3D(fdTopPlus, W / 2, 523);
const pTopP_V560 = localTo3D(fdTopPlus, W / 2, 560);
console.log('V=0:   CAD Y =', mTop.transformPoint(new Vec3(pTopP_V0[0], pTopP_V0[1], pTopP_V0[2])).y);
console.log('V=37:  CAD Y =', mTop.transformPoint(new Vec3(pTopP_V37[0], pTopP_V37[1], pTopP_V37[2])).y);
console.log('V=523: CAD Y =', mTop.transformPoint(new Vec3(pTopP_V523[0], pTopP_V523[1], pTopP_V523[2])).y);
console.log('V=560: CAD Y =', mTop.transformPoint(new Vec3(pTopP_V560[0], pTopP_V560[1], pTopP_V560[2])).y);

console.log('2. Wieniec górny z FACE_Z_MINUS:');
const fdTopMinus = computeFaceData('FACE_Z_MINUS', W, D, T);
const pTopM_V0 = localTo3D(fdTopMinus, W / 2, 0);
const pTopM_V37 = localTo3D(fdTopMinus, W / 2, 37);
const pTopM_V523 = localTo3D(fdTopMinus, W / 2, 523);
const pTopM_V560 = localTo3D(fdTopMinus, W / 2, 560);
console.log('V=0:   CAD Y =', mTop.transformPoint(new Vec3(pTopM_V0[0], pTopM_V0[1], pTopM_V0[2])).y);
console.log('V=37:  CAD Y =', mTop.transformPoint(new Vec3(pTopM_V37[0], pTopM_V37[1], pTopM_V37[2])).y);
console.log('V=523: CAD Y =', mTop.transformPoint(new Vec3(pTopM_V523[0], pTopM_V523[1], pTopM_V523[2])).y);
console.log('V=560: CAD Y =', mTop.transformPoint(new Vec3(pTopM_V560[0], pTopM_V560[1], pTopM_V560[2])).y);

