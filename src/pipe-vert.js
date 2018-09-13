var THREE = window.THREE
var jsfxr = window.jsfxr
var TWEEN = window.TWEEN
var AFRAME = window.AFRAME
// var floor = document.getElementById


// Constants

const one = new THREE.Vector3(1, 1, 1)
const waterColor = 0x0088ff
const tubeGlassColor = 0x8888aa
const height = 1.6
const scale = 0.5
const scaleV = one.clone().multiplyScalar(scale)
const bubbleSpeed = 0.008
const bubbleSize = 0.1 * scale
const overflowSize = 0.175 * scale
const bubbleCount = 30
const overflowCount = 50
const wallColor = 0x888888


// Global references

var fadeEl, fade, fadeMaterial
var waterEl, waterComponent, water
var cameraEl, camera
var teleporter
var rigEl, rig
var textEl
var pipesEl

var floorCircle
var floor

var vrController

var level

// TODO: minify: remove document.getElementById()
function setupHandles() {
  console.log('setupHandles')
  fadeEl = document.getElementById('fade')
  fade = fadeEl.object3D
  fadeMaterial = fadeEl.components.material.material

  waterEl = document.getElementById('water')
  waterComponent = waterEl.components.water
  water = waterEl.object3D
  
  cameraEl = document.getElementById('camera')
  camera = cameraEl.object3D
  
  teleporter = document.getElementById('teleporter').object3D
  
  rigEl = document.getElementById('rig')
  rig = rigEl.object3D
  
  textEl = document.getElementById('dialogue')
  
  pipesEl = document.getElementById('pipes')
  
  floorCircle = document.getElementById('floor-circle')
  floor = document.getElementById('floor')
  
  level = document.getElementById('level')
}


// Create textures

var bubbleTexture = createBubbleTexture(false)
var dropletTexture = createBubbleTexture(true)
var shadowMaterials = [createShadowMaterial(0.5), createShadowMaterial(0.2)]

function createCanvas(size) {
  var canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return {canvas, ctx: canvas.getContext('2d')}
}

function createShadowMaterial(start) {
  var {canvas, ctx} = createCanvas(256)
  var gradient = ctx.createRadialGradient(128, 128, 128 * start, 128, 128, 128 * (start + 0.25));
  gradient.addColorStop(0, 'rgba(0,0,0,.33)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 255, 255)
  return new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(canvas), side: 2 /* THREE.DoubleSide */, transparent: true})
}

function createBubbleTexture(isFilled) {
  var {canvas, ctx} = createCanvas(32)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(16, 16, 14, 0, Math.PI * 2)
  ctx.stroke()
  if (isFilled) ctx.fill()
  ctx.beginPath()
  ctx.arc(12, 10, 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fill()
  return new THREE.CanvasTexture(canvas)
}

var warningTextureX = createWarningTexture()
var warningTextureZ = createWarningTexture()

function createWarningTexture() {
  var {canvas, ctx} = createCanvas(256)
  ctx.strokeStyle = 'yellow'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 255, 255)
  ctx.lineWidth = 42
  for (var i = 0; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 128 - 256, -64)
    ctx.lineTo(i * 128 - 256 + 256 + 128, 256 + 64)
    ctx.stroke()
  }
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, 255, 10)
  return new THREE.CanvasTexture(canvas, 300 /* THREE.UVMapping */, 1000 /* THREE.RepeatWrapping */)
}

var floorTexture = createFloorTexture()

function createFloorTexture() {
  var {canvas, ctx} = createCanvas(256)
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, 255, 255)
  ctx.lineWidth = 2
  ctx.rotate(Math.PI / 4)
  ctx.translate(0, -192)
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 12; j++) {
      for (var k = 0; k < 4; k++) {
        ctx.strokeStyle = '#aaa'
        ctx.beginPath()
        ctx.moveTo(0 + i * 64, k * 5 + j * 32)
        ctx.lineTo(16 + i * 64, k * 5 + j * 32)
        ctx.stroke()
        ctx.strokeStyle = '#ccc'
        ctx.beginPath()
        ctx.moveTo(0 + i * 64 + 32 + k * 5, 0 + j * 32)
        ctx.lineTo(0 + i * 64 + 32 + k * 5, 16 + j * 32)
        ctx.stroke()
      }
    }
  }
  return new THREE.CanvasTexture(canvas, 300 /* THREE.UVMapping */, 1000 /* THREE.RepeatWrapping */, 1000 /* THREE.RepeatWrapping */)
}

// TODO: min -- use recursion to call the create function 8 times
var sparkTextures = new Array(8).fill(0).map(i => createSparkTexture())

function createSparkTexture() {
  var {canvas, ctx} = createCanvas(256)
  ctx.strokeStyle = '#70a6ff'
  ctx.shadowColor = '#fff'
  ctx.save()
  for (var i = 0; i < 20; i++) {
    drawSpark(ctx, 3, 128, 128, Math.random() * Math.PI * 2, Math.PI, Math.random() * 50 - 25 + 50, 3)
  }
  return new THREE.CanvasTexture(canvas)
}

function drawSpark(ctx, w, x, y, theta, dtheta, r, n) {
  ctx.lineWidth = w
  ctx.shadowBlur = 16
  ctx.beginPath()
  ctx.moveTo(x, y)
  x += Math.sin(theta) * r
  y += Math.cos(theta) * r
  ctx.lineTo(x, y)
  ctx.stroke()

  if (n) drawSpark(ctx, w * 0.75, x, y, theta + Math.random() * dtheta - dtheta / 2, dtheta / 2, r * 0.6, n - 1)
}


var wallMaterialX = new THREE.MeshStandardMaterial({color: wallColor, side: 2 /* THREE.DoubleSide */, map: warningTextureX})
var wallMaterialZ = new THREE.MeshStandardMaterial({color: wallColor, side: 2 /* THREE.DoubleSide */, map: warningTextureZ})
var floorMaterial = new THREE.MeshStandardMaterial({color: wallColor, side: 2 /* THREE.DoubleSide */, map: floorTexture})
var ceilMaterial = new THREE.MeshStandardMaterial({color: wallColor, side: 2 /* THREE.DoubleSide */})
var clearMaterial = new THREE.MeshStandardMaterial({color: '#eee', side: 1 /* THREE.BackSide */, transparent: true, opacity: 0.3, emissive: 0xffffff})

var levelSize = new THREE.Vector3()
var scaledLevelSize = new THREE.Vector3()

var createLevelGeometry = () => {
  var size = levelSizes[activeScene]
  levelSize.set(...size)

  warningTextureX.repeat.set(levelSize.x / 2, 4)
  warningTextureZ.repeat.set(levelSize.z / 2, 4)
  floorTexture.repeat.set(levelSize.x / 2, levelSize.z / 2)
  
  scaledLevelSize.copy(levelSize).multiplyScalar(scale)

  const showWindow = activeScene === 'intro'

  var s = [size[0] + 1 - 0.6, size[1] + 1 - 0.6, size[2] + 1 - 0.6]
  var mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...s, 1),
    [wallMaterialZ, showWindow ? clearMaterial : wallMaterialZ, floorMaterial, floorMaterial, wallMaterialX, wallMaterialX]
  )
  mesh.position.copy(levelSize).multiplyScalar(.5).addScalar(1)

  if (showWindow) {
    for (var i = 0; i < 4; i++) {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(0.75, 6.4, 11), [wallMaterialZ, ceilMaterial, ceilMaterial, ceilMaterial, ceilMaterial, ceilMaterial])
      wall.position.set(-5.001 + 0.01 * (i % 2), (1 - i) % 2 * 4.3, (i - 2) % 2 * 8.8)
      wall.rotation.x = Math.PI * (i === 2 ? 1 : 0)
      mesh.add(wall)
    }

    var points = new THREE.Geometry()
    for (var i = 0, s = 5000; i < 2000; i++) {
      var r = (Math.random() ** 0.75) * s / 2
      var theta = Math.random() * Math.PI * 2
      points.vertices.push(new THREE.Vector3(Math.random() * s / 10 - 800, Math.sin(theta) * r, Math.cos(theta) * r))
      // points.vertices.push(new THREE.Vector3(Math.random() * s / 10 - 800, Math.random() * s - s / 2, Math.random() * s - s / 2))
    }
    mesh.add(new THREE.Points(points, new THREE.PointsMaterial()))
  }

  level.object3D.add(mesh)
}

var pipeLists3 = {
  'intro': [
    // '011xg2^XYYXXyx',
    // '201yg2^Y0YY',
    '011xXYYX',//Xyx',
    '201yg2^Y0YYXyx',
    '411yYX',
    '511yYYxy',
    '611XYYX',
    // '711XYXXXX',
    // '711XYX',
    // 'a21XxxxyX',
    '721XyX',
    '731yX',
    //
    '930z2^ZZ0Zyyz',
    '922yY',
    '944Y2yyyZYYYY',
    '917ZzYYZZZZ',
    '908yYYY',
    '93bZ2^z0yyz',
    //
    '160z1WZZZZZZZZZZZZ',
    '150z1WZZZZZZZZZZZZ',
    '14bZ1^Wz',
  ],
  'room1': [
    '130z2ZZZZZZGZ',
    '230z1ZZ^Z0SZZZGZ',
    '022x1XXX^X0SXXSXXGX',
    '622yY',
    '601y2rYXZyGy',
    '602y2rYxxxxyGy',
  ],
  'room2': [
    '032x1/gXX^X0SXXXXXGX',
    '520z2/gZ^Z0SZSZSZZGZ',
    '105y1WYY^Y',
    '336z0WGZ',
  ],
  'room3': [
    '202y2r^Y',
    '854y0GY',
    '345Z1W^z',
    '610Z0WGz',
    '604y2YYYYYGY',
    '551Y8gyyyyyGy',
  ],
  'room4': [
    '320z1/Z^Z',
    '420z2Z^Z',
    '530z1W^Z',

    '448zZZ0GZ',
    '548zZZ0GZ',
    '358yW0GY',

    '114yYYY',
    '115yWYYY',
  ],
}

var rigs = {
  intro: { pos: [5, 0.5, 9], dir: [0, Math.PI / 4, 0] },
  room1: { pos: [6, 0.5, 4], dir: [0, Math.PI / 4, 0] },
  room2: { pos: [6, 0.5, 3], dir: [0, Math.PI / 4, 0] },
  room3: { pos: [4, 0.5, 4], dir: [0, Math.PI / 4, 0] },
  room4: { pos: [4, 0.5, 4], dir: [0, Math.PI / 4, 0] },
}

var goals = {
  intro: 10,
  room1: 2,
  room2: 3,
  room3: 2,
  room4: 3,
}

var allowedPieces = {
  intro: [],
  room1: ['-x>+x', '-y>+y'],
  room2: ['-x>+x', '-y>+y', '-y>+z', '+y>-x'],
  room3: ['-x>+x', '-y>+y', '-y>+z', '+y>-x'],
  room4: ['-y>+z', '+y>-x'],
}

var sceneAllowsWire = {
  intro: false,
  room1: false,
  room2: true,
  room3: true,
  room4: true,
}

var levelSizes = {
  intro: [9, 6, 10],
  room1: [7, 4, 5],
  room2: [7, 4, 5],
  room3: [9, 4, 4],
  room4: [7, 4, 9],
}


// Pipe direction-related lookups

function vectorize(arr) {
  return arr.reduce((a, c) => {
    a[c[0]] = new THREE.Vector3(...c[1])
    return a
  }, {})
}

const pipeBolt = 0.1
const wireBolt = 0.02

// TODO: Implement lookup tables as single strings with indexOf

function pipeEndsBuilder(offs) {
  return vectorize([
    ['-y', [0.5, offs, 0.5]],
    ['+y', [0.5, 1 - offs, 0.5]],
    ['-x', [offs, 0.5, 0.5]],
    ['+x', [1 - offs, 0.5, 0.5]],
    ['-z', [0.5, 0.5, offs]],
    ['+z', [0.5, 0.5, 1 - offs]],
  ])
}

var pipeEnds = pipeEndsBuilder(pipeBolt)
var pipeEnds2 = pipeEndsBuilder(0)
var wireEnds = pipeEndsBuilder(wireBolt)

var dirToVector = {
  '+x': new THREE.Vector3(1, 0, 0),
  '-x': new THREE.Vector3(-1, 0, 0),
  '+y': new THREE.Vector3(0, 1, 0),
  '-y': new THREE.Vector3(0, -1, 0),
  '+z': new THREE.Vector3(0, 0, 1),
  '-z': new THREE.Vector3(0, 0, -1),
}

var cylinderDir = vectorize([
  ['+y', [1, 0, 0]],
  ['-y', [-1, 0, 0]],
  ['+z', [0, 1, 0]],
  ['-z', [0, -1, 0]],
  ['+x', [1, 0, 0]],
  ['-x', [-1, 0, 0]],
])

var cyAxis = {
  '-x': '+z',
  '+x': '+z',
  '-y': '+y',
  '+y': '+y',
  '-z': '+x',
  '+z': '+x',
}

var ringAxis = {
  '-x': '+y',
  '+x': '+y',
  '-y': '+x',
  '+y': '+x',
  '-z': '+x',
  '+z': '+x',
}

var ringAngle = {
  '-x': -1,
  '+x': 1,
  '-y': 1,
  '+y': -1,
  '-z': 2,
  '+z': 0,
}

var pipeKindOpps = {
  x: 'X', X: 'x',
  y: 'Y', Y: 'y',
  z: 'Z', Z: 'z',
}

var pipeKinds = {
  x: '-x', X: '+x',
  y: '-y', Y: '+y',
  z: '-z', Z: '+z',
}

var signOpps = { '-': '+', '+': '-' }

function flipSign(dir) {
  return signOpps[dir[0]] + dir[1]
}


// Audio

var sounds = {}

function addSound(key, settings) {
  var count = 2
  sounds[key] = {
    tick: 0,
    count,
    pools: []
  }
  for (var i = 0; i < count; i++) {
    var audio = new Audio()
    audio.src = jsfxr(settings)
    sounds[key].pools.push(audio)
  }
}

function playSound(key) {
  var data = sounds[key]
  data.pools[data.tick].play()
  data.tick = (data.tick + 1) % 2
}

/* UNDERWATER SOUNDS
//         var audio = new Audio()
//         var l = elem.slice()
//         l.splice(5, 1, elem[5] * 0.5)
//         l.splice(7, 1, elem[7] * 0.5)
//         l.splice(18, 1, elem[18] * 0.5)
//         l.splice(19, 1, 0.4)
//         l.splice(20, 1, elem[20] * 0.5)
//         l.splice(22, 1, 0.5)
//         audio.src = jsfxr(l)
*/

addSound('fill-next', [0,,0.0147,0.4249,0.4668,0.6611,,,,,,0.4497,0.6119,,,,,,1,,,,,0.5])
addSound('place', [0,,0.0458,0.4093,0.138,0.5686,,,,,,,,,,,,,1,,,,,0.5])
addSound('remove', [0,,0.1476,0.0523,0.3758,0.5554,0.0027,-0.4491,,,,,,0.5355,-0.6771,,0.0444,-0.0065,1,,,0.0527,,0.5])
addSound('win', [0,,0.0933,0.527,0.4935,0.8242,,,,,,0.221,0.6077,,,,,,1,,,,,0.5])
addSound('lose', //[3,0.1133,0.2773,0.2864,0.7169,0.5079,,-0.3071,0.0757,,0.5001,0.9297,0.0836,0.0385,-0.1471,0.3817,-0.4427,0.2628,0.8795,-0.022,0.8672,0.0034,-0.0197,0.5])
       [0,0.0075,0.1024,0.5235,0.8863,0.5433,,-0.7012,-0.1184,0.4248,0.4375,-0.8011,0.1484,0.1565,-0.1495,0.8906,0.3208,0.2664,0.3981,-0.0033,-0.4648,0.0004,-0.1169,0.5])
addSound('notice', [2,0.0008,0.0718,0.0181,0.6147,0.3236,,-0.0572,0.7976,,0.5104,0.8783,0.8249,0.762,-0.0573,0.6483,-0.184,-0.0645,0.7087,-0.5083,,0.0066,0.2721,0.5])
addSound('zap', [0,0.4405,0.01,0.3221,0.2943,0.5842,,0.5361,0.5834,0.0991,-0.1122,0.2115,0.4555,,-0.5842,0.8535,0.666,-0.9759,0.8609,-0.2102,0.925,0.7556,,0.5])
addSound('warn', [2,0.0075,0.8721,0.3728,0.6914,0.5,,-0.0056,-0.7544,-0.7663,-0.983,0.0774,0.3114,-0.9683,-0.1861,0.7659,-0.1718,0.0255,0.9996,-0.6681,0.1984,0.2018,0.6074,0.5])
addSound('teleport', [0,0.034,0.4499,0.1862,0.5786,0.1709,,-0.0272,0.0442,-0.014,,-0.3739,0.6,,0.6944,0.7795,,0.7813,0.0327,0.3626,0.8632,0.1002,-0.1566,0.5])


// Score handling

var highScores = (localStorage.highScores || '').split(',').map(n => +n)
var score = 0
var flowBonus = 0
var overflowBonus = 0

function addToScore(scoreToAdd) {
  score += scoreToAdd
  document.getElementById('score').setAttribute('text', {value: 'Score: ' + score + '\n\nOverflow Bonus: ' + overflowBonus + '\nFlow Bonus: ' + flowBonus})
}

function finalizeScore() {
  highScores.push(score)
  highScores.sort((a, b) => a - b).reverse().splice(10)
  localStorage.highScores = highScores.join(',')
}

function renderHighScores() {
  var formatScore = (s, i) => (i + 1) + '.\t\t' + s.toLocaleString() + (s === score ? ' <<' : '')
  document.getElementById('high-scores').setAttribute('text', {
    value: 'High Scores\n\n' + highScores.map(formatScore).join('\n')
  })
}


// Grid of pipes-related

var grid
var nextCoordHelper = new THREE.Vector3()

function canPlaceInGrid(v) {
  return (v.x > 0 && v.y > 0 && v.z > 0 && v.x < levelSize.x + 1 && v.y < levelSize.y + 1 && v.z < levelSize.z + 1)
}

function isGridEdge(v) {
  return (v.x === 0 || v.y === 0 || v.z === 0 || v.x === levelSize.x + 1 || v.y === levelSize.y + 1 || v.z === levelSize.z + 1)
}

function isInGrid(v) {
  return canPlaceInGrid(v) || isGridEdge(v)
}

function pipeAt(pos, pipe) {
  if (!isInGrid(pos)) return
  // var el = grid[pos.x][pos.y][pos.z]
  var el = grid[pos.x * 16 * 16 + pos.y * 16 + pos.z]
  var p = el && el.components.pipe
  return pipe ? p && !!p.data.isWire === !!pipe.data.isWire && p : p
}

var hasMorePipes, hasMoreWires

function updatePipes() {
  sources.forEach(s => s.updatePipes())
  hasMorePipes = !sources.filter(s => !s.data.isWire).every(s => s.reachesGoal)// && s.pipes[s.pipes.length - 1].amount === 1)
  hasMoreWires = !sources.filter(s => s.data.isWire).every(s => s.reachesGoal)// && s.pipes[s.pipes.length - 1].amount === 1)
  return sources.filter(s => s.reachesGoal).length
}


// Game state

var isVR = false
var isPlaying = true // We start with "playing" so that we can fade in (iirc)


// Level state

var activeScene
var sources = []
var fillSpeedMultiplier = 1
var toFill = []
var isPlacing = false
var canOverflow
var colorVolumes = {}
var canTeleport = false
var isOverflowing = false


// Level-related game scripts

function setRigPos(targetWorld) {
  var offsWorld = new THREE.Vector3()
  rig.getWorldPosition(offsWorld).sub(cameraWorldPosition)

  targetWorld.add(offsWorld)

  rig.parent.worldToLocal(targetWorld)
  const y = 0.3 * scale + (isVR ? 0 : 1.6)
  console.log(y)
  rig.position.set(targetWorld.x, y, targetWorld.z)
}

function showScene(name) {
  // Clear any existing level geometry
  level.innerHTML = ''
  level.object3D.children = []

  // Show or hide the custom geometry for the intro level
  document.getElementById('intro-scene').setAttribute('visible', name === 'intro')

  // Re-initialize the grid of placed pipes
  grid = new Array(16 * 16 * 16).fill(0)
  
  toFill = []
  
  document.getElementById('pipes').innerHTML = ''
  document.getElementById('liquid').object3D.children = []
  document.getElementById('bubbles').object3D.children = []

  setupPipes3(name)
  waterComponent.reset()

  // TODO: min - inline the rigs object
  var {pos, dir} = rigs[name]
  var targetWorld = new THREE.Vector3(...pos)
  level.object3D.localToWorld(targetWorld)
  setRigPos(targetWorld)
  rig.rotation.set(...dir)
  
  sources = []
  fillSpeedMultiplier = 1
  
  activeScene = name
  overflowBonus = 1000
  hasMorePipes = true
  hasMoreWires = true
  isUnderwater = false

  createLevelGeometry()
  grabbedKind = null
}

function startFilling() {
  toFill.forEach(f => f.components.pipe.isFilling = true)
}

function setupPipes3(name) {
  // TODO: min - implement 7-bit packed strings, 2 3-bit pipe directions per character
  pipeLists3[name].forEach(commands => {
    var pos = new THREE.Vector3(...(commands.split('', 3).map(n => parseInt(n, 16))))
    var fillSpeed = 0
    var isSource
    var isFilling = false
    var skip = false
    var isGoal = false
    var color = waterColor
    var isWire = false
    var k = pipeKindOpps[commands.slice(3, 4)]
    var cmds = commands.slice(4)
    var lookup = {
      '/': () => fillSpeed /= 2,
      g: () => color = 0x00ff00,
      r: () => color = 0xff0000,
      W: () => (isWire = true, fillSpeed *= 100),
      S: () => skip = true,
      '^': () => isFilling = true,
      G: () => isGoal = true,
    }
    for (var j in cmds) {
      var c = cmds[j]
      var lastK = pipeKindOpps[k]
      var fn = lookup[c]
      var n = parseInt(c)
      if (fn) {
        fn()
      }
      else if (!isNaN(n)) {
        fillSpeed = n
        isSource = n > 0
      }
      else {
        k = c
        if (!skip) {
          console.log('placing pipe at', pos)
          var el = document.createElement('a-entity')
          el.setAttribute('position', pos.clone())
          el.setAttribute('pipe', {
            kind: pipeKinds[lastK] + '>' + pipeKinds[k],
            place: true,
            fillSpeed,
            amount: fillSpeed > 0 ? 1 : 0,
            isSource,
            isGoal,
            isFilling,
            color,
            isWire
          })
          pipesEl.appendChild(el)
          if (isFilling) {
            toFill.push(el)
          }
        }
        pos.add(dirToVector[pipeKinds[k]])
        skip = false
        isFilling = false
        isGoal = false
        isSource = false
      }
    }
  })
}

var isFading = true

async function fadeTo(c, a, out, delay) {
  if (a === 1) {
    playSound('teleport')
  }
  isFading = true
  fadeMaterial.color.set(c)
  return new Promise(resolve => {
    fade.visible = true
    new TWEEN.Tween(fadeMaterial)
      .to({opacity: a}, 1000)
      .delay(delay || 0)
      .onComplete(resolve)
      .start()
  }).then(() => {
    fade.visible = !out
    isFading = false
  })
}


// Diaglogue and instructions handling

var textToShow
var shownText = ''

function showText(value) {
  textEl.setAttribute('text', {value})
  textEl.setAttribute('visible', true)
}

function showInstructions(value) {
  document.getElementById('instructions').setAttribute('text', {value})
  document.getElementById('instructions').setAttribute('visible', true)
}

function hideInstructions() {
  document.getElementById('instructions').setAttribute('visible', false)
}

function hideText() {
  textEl.setAttribute('visible', false)
}

async function showOverview(text, click) {
  await wait(1)
  showText(text)
  if (click) {
    await waitForClick()
  }
  else {
    await wait(2)
  }
  hideText()
}

async function showWarning(text) {
  playSound('warn')
  showText(text)
  await wait(5)
  hideText()
}

async function showDialogue(text) {
  playSound('notice')
  shownText = 'CAPTAIN\n\n'
  textToShow = shownText + text
  showText(shownText)
  textEl.setAttribute('text', {align: 'left'})
  
  while (textToShow !== shownText) {
    // TODO: min
    if (await Promise.race([waitForClick(), wait(0.02)]) === 'click') {
      shownText = textToShow
    }
    else {
      shownText = textToShow.substr(0, shownText.length + 1) 
    }
    showText(shownText)
  }
  showText(shownText + '\n\n[click to continue]')
  await waitForClick()
  hideText()
}


// Game script-related

async function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

async function waitForGrabPipe() {
  return new Promise(resolve => window.addEventListener('grab-pipe', resolve))
}

async function waitForClick() {
  return new Promise(resolve => window.addEventListener('click-triggered', e => resolve('click')))
}

async function waitForTeleport() {
  return new Promise(resolve => window.addEventListener('teleported', resolve))
}

async function waitForProximityToRoomTeleporter() {
  return new Promise(resolve => window.addEventListener('start-game', resolve))
}

async function waitForEndLevel() {
  return new Promise(resolve => window.addEventListener('finish-level', e => resolve(e.detail)))
}

async function waitForPlacePipe() {
  return new Promise(resolve => window.addEventListener('place-pipe', resolve))
}

async function lose() {
  await showOverview('Game Over\nScore ' + score.toLocaleString() + '\n' + loseReason, true)
  await fadeTo('#000', 1, 0, 1000)
}

// Game script

var isGameStarted
var loseReason

async function startIntroRoom() {
  while (true) {
    renderHighScores()

    isGameStarted = false
    canOverflow = true
    canTeleport = false
    document.getElementById('score').setAttribute('visible', false)

    await wait(0.1)
    showScene('intro')
    await fadeTo('#000', 0, 1, 1000)
    await wait(0.1)
    isPlacing = false
    startFilling()

    await showOverview('[click to start]', true)
    await wait(1)
    await showDialogue('Crew, we just exited the wormhole. Everyone to stations and check ship status.')

    if (isVR) {
      canTeleport = true
      await wait(1)
      showInstructions('Aim at the floor and press the thumbpad/thumbstick to move')
      await waitForTeleport()
      showInstructions('Good! Enter the white teleporter circle to start')
    }
    else {
      showInstructions('Use WASD + mouse. Enter the white teleporter circle to start')
    }

    await waitForProximityToRoomTeleporter()
    hideInstructions()

    isGameStarted = true
    score = 0
    flowBonus = 0
    await fadeTo('#88f', 1, 0)
    await startGame()
  }
}

var rooms = {}
rooms.room2 = buildRoom('room2', 'Fix the pipes and the wire. Don\'t let the shield goop touch the live end of a wire', 'Shields are back online and warming up', 'room3')
rooms.room3 = buildRoom('room3', null, 'Weapons powering up', 'room4')
rooms.room4 = buildRoom('room4', null, 'Crew, we are back at 100%! Time to try another wormhole!', null)

async function startGame() {
  canTeleport = false
  showScene('room1')
  await fadeTo('#88f', 0, 1)

  document.getElementById('score').setAttribute('visible', true)
  canOverflow = false
  startFilling()
  
  await wait(1)
  await showDialogue('We are getting reports that small pockets of the ship have vanished after exiting the wormhole! Engine cooling, shields, and weapons are offline! Fix broken systems ASAP')

  canOverflow = true
  isPlacing = true
  isPlaying = true
  canTeleport = true

  ;(async () => {
    await wait(1)
    if (isVR) {
      showInstructions('Fix both pipes before the engine coolant fills the room. Use the trigger to grab an empty pipe or create a new pipe piece')
      await waitForGrabPipe()
      showInstructions('You can only have one active (green) pipe at once. Snap it into place before grabbing or creating a new pipe piece')
      await waitForPlacePipe()
      showInstructions('Long-press the thumbpad to give up if you get stuck')
    }
    else {
      showInstructions('Fix both pipes before the engine coolant fills the room. Click on a pipe to grab it or click elsewhere to create a random pipe piece')
      await waitForGrabPipe()
      showInstructions('Rotate with Q/E and R/F. Aim and click to place the pipe when it locks into place')
      await waitForPlacePipe()
      showInstructions('You can hold one pipe piece at once. Press L to give up if you get stuck')
    }
    await wait(10)
    hideInstructions()
  })()

  if (await waitForEndLevel()) {
    canTeleport = false
    fillSpeedMultiplier = 1
    await showDialogue('Engine cooling is back online and engines are charging up')
    await fadeTo('#88f', 1, 0)
    await rooms.room2()
  }
  else {
    await lose()
  }
}

function buildRoom(name, instructions, dialogue, next) {
  return async function() {
    canTeleport = false
    showScene(name)
    await fadeTo('#88f', 0, 1)
    canOverflow = true
    isPlacing = true
    isPlaying = true
    canTeleport = true
    startFilling()

    if (instructions) {
      ;(async () => {
        await wait(2)
        showInstructions(instructions)
        await wait(10)
        hideInstructions()
      })()
    }

    if (await waitForEndLevel()) {
      canTeleport = false
      fillSpeedMultiplier = 1
      await showDialogue(dialogue)
      await fadeTo('#88f', 1, 0)
      if (next) {
        await rooms[next]()
      }
      else {
        finalizeScore()
        await showOverview('YOU WIN\nScore ' + score.toLocaleString(), true)
      }
    }
    else {
      await lose()
    }
  }
}


// Win/lose level

function checkWin() {
  if (!sources.every(s => s.reachesGoal && s.pipes[s.pipes.length - 1].amount === 1)) return

  addToScore(overflowBonus)
  isPlaying = false
  playSound('win')
  window.dispatchEvent(new CustomEvent('finish-level', {detail: true}))
}

function loseGame(reason) {
  loseReason = reason
  finalizeScore()
  isPlaying = false
  window.dispatchEvent(new CustomEvent('finish-level', {detail: false}))
}


// Pipe component

var midV = new THREE.Vector3(0.5, 0.5, 0.5)

var tubeMaterial = new THREE.MeshStandardMaterial({color: tubeGlassColor, transparent: true, opacity: 0.6, emissive: 0x727272})
var innerTubeMaterial = new THREE.MeshStandardMaterial({color: tubeGlassColor, transparent: true, opacity: 0.6, emissive: 0x727272, side: 1 /* THREE.BackSide */})
var placingMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, emissive: 0x727272})
var wireMaterial = new THREE.MeshStandardMaterial({color: 0xa08d00, roughness: 0.87, metalness: 0.11})

var bubbleMaterial = new THREE.PointsMaterial({
  size: bubbleSize / 2 * window.devicePixelRatio,
  side: 2 /* THREE.DoubleSide */,
  transparent: true,
  opacity: 0.75,
  alphaTest: 0.1,
  map: bubbleTexture,
})

function createMesh(geo, mat, ro) {
  var m = new THREE.Mesh(geo, mat)
  m.renderOrder = ro
  return m
}

var wirePosHelper = new THREE.Vector3()
var up = new THREE.Vector3(0, 0, 1)
var dirHelper = new THREE.Vector3()
var p2Helper = new THREE.Vector3()
var p1Helper = new THREE.Vector3()
var p0Helper = new THREE.Vector3()

var bzzSound = () => jsfxr([0,0.2195,0.4246,0.1583,0.2072,0.0883,,0.0949,0.0035,-0.4383,-0.4315,-0.0843,0.1909,0.1572,0.0053,-0.2627,-0.7051,0.1504,0.8556,-0.0003,0.0137,,,0.4])
var refDistance = 1
var rolloffFactor = 20

AFRAME.registerComponent('pipe', {
  schema: {
    // color: {type: 'color', default: waterColor},
    // kind: {type: 'string', default: null},
    // amount: {type: 'number', default: 0},
    // isFilling: {type: 'boolean', default: false},
    // isFlowingForward: {type: 'boolean', default: true},
    // isGoal: {type: 'boolean', default: false},
    // place: {type: 'boolean', default: false},
    fillSpeed: {type: 'number', default: 1},
    // isSource: {type: 'boolean', default: false},
    // isWire: {type: 'boolean', default: false},
  },

  init: function () {
    var data = this.data
    data.color = data.color || waterColor
    data.isFlowingForward = true
    
    if (data.isSource) {
      sources.push(this)
    }

    if (data.place) {
      var pos = this.el.object3D.position
      var existing = grid[pos.x * 16 * 16 + pos.y * 16 + pos.z]
      if (existing) {
        existing.parentNode.removeChild(existing)
        addToScore(-10)
      }
      grid[pos.x * 16 * 16 + pos.y * 16 + pos.z] = this.el
      this.checkGoals = true
    }

    this.updateMesh(this.data.kind, this.data.isWire)
    
    this.bubbles = {
      object3D: document.getElementById('bubbles').object3D,
      count: bubbleCount,
      material: bubbleMaterial,
      renderOrder: 10,
      create: () => ({
        t: Math.random() * 10 - 9,
        theta: Math.random() * Math.PI * 2,
        r: Math.random() * 0.125,
        position: new THREE.Vector3(),
        source: this
      }),
      update: (p, dt) => {
        var t = clamp(p.t, 0, 999)
        var i = Math.floor(t)
        var pipe = p.source.pipes[i]
        var pt = t % 1

        if (pipe && pt <= pipe.amount) {
          // Update position
          setBubblePosition(p)

          // Update the particle's time for next frame
          const speed = pipe.data.fillSpeed * bubbleSpeed * fillSpeedMultiplier * dt / 1000 * 60
          p.t += speed
        }
        else {
          // Reset position
          p.t = Math.random() * 10 - 9
          p.normal = null // TODO: needed?
        }
      }
    }
  },

  updateMesh: function (kind, isWire) {
    if (!kind) return
    var [dirIn, dirOut] = kind.split('>')

    // TODO: Set amount based on isFilling
    this.amount = this.data.amount || 0
    this.lastAmount = this.amount
    this.kind = kind
    this.isFilling = this.data.isFilling
    this.isNextFilling = false // needed?

    this.data.isWire = isWire

    var o3d = this.el.object3D
    o3d.children = []

    // Setup some variables that differ between pipes and wires
    var [r1, r2, r3, r4, d1] = this.data.isWire ? [0.07, 0.05, 0.04, 0.04, wireBolt] : [0.25, 0.2, 0.151, 0.15, pipeBolt]
    var ends = this.data.isWire ? wireEnds : pipeEnds

    // Create the curves for the pipe
    this.fullCurve = new THREE.QuadraticBezierCurve3(pipeEnds2[dirIn], midV, pipeEnds2[dirOut])
    this.frenetFrames = this.fullCurve.computeFrenetFrames(10)
    var outerCurve = new THREE.QuadraticBezierCurve3(ends[dirIn], midV, ends[dirOut])

    // Build the glass tube

    this.tubeMaterial = this.data.place ? (isWire ? wireMaterial : tubeMaterial).clone() : placingMaterial.clone()
    var outerTube = createMesh(new THREE.TubeBufferGeometry(outerCurve, 20, r2), this.tubeMaterial, 2)
    var innerTube = createMesh(new THREE.TubeBufferGeometry(this.fullCurve, 20, r3), innerTubeMaterial, 1)
    o3d.add(outerTube, innerTube)

    var boltCyGeo = new THREE.CylinderGeometry(r1, r1, d1, 8, 1, true)
    var boltRingOutGeo = new THREE.RingGeometry(r3, r1, 8)
    var boltRingInGeo = new THREE.RingGeometry(r2, r1, 8)

    for (var i = 0; i < 2; i++) {
      var dir = [dirIn, dirOut][i]
      var opp = flipSign(dir)

      console.log('boltcymesh', dirIn, dirOut, dir, cyAxis[dir], dirToVector[cyAxis[dir]])
      var boltCyMesh = createMesh(boltCyGeo, this.tubeMaterial, 2)
      boltCyMesh.rotateOnAxis(dirToVector[cyAxis[dir]], Math.PI / 2)
      boltCyMesh.position.copy(pipeEnds2[dir]).add(dirToVector[opp].clone().multiplyScalar(d1 / 2))

      var boltRingOutMesh = createMesh(boltRingOutGeo, this.tubeMaterial, 2)
      boltRingOutMesh.rotateOnAxis(dirToVector[ringAxis[dir]], ringAngle[dir] * Math.PI / 2)
      boltRingOutMesh.position.copy(pipeEnds2[dir])

      var boltRingInMesh = createMesh(boltRingInGeo, this.tubeMaterial, 2)
      boltRingInMesh.rotateOnAxis(dirToVector[ringAxis[dir]], ringAngle[dir] * Math.PI / 2 + Math.PI)
      boltRingInMesh.position.copy(ends[dir])

      o3d.add(boltCyMesh, boltRingInMesh, boltRingOutMesh)
    }

    // Add a shadow if the pipe intersects a surface
    if (isGridEdge(this.el.object3D.position)) {
      var shadow = new THREE.Mesh(new THREE.PlaneGeometry(), shadowMaterials[isWire ? 1 : 0])
      shadow.rotateOnAxis(dirToVector[ringAxis[dirIn]], ringAngle[dirIn] * Math.PI / 2)
      shadow.position.set(0.5, 0.5, 0.5).add(dirToVector[dirIn].clone().multiplyScalar((this.data.isSource ? -1 : 1) * 0.31))
      o3d.add(shadow)
    }

    // Build the liquid

    this.geometry = new THREE.TubeBufferGeometry(this.fullCurve, 200, r4)
    this.updateDrawRange()
    this.material = new THREE.MeshToonMaterial({color: this.data.color, transparent: true, opacity: 0.75})
    this.mesh = createMesh(this.geometry, this.material, 3)
    this.mesh.position.copy(this.el.components.position.attrValue)

    this.endCap = createMesh(new THREE.CircleGeometry(r4), this.material, 3)
    this.mesh.add(this.endCap)
    this.updateEndCap()

    document.getElementById('liquid').object3D.add(this.mesh)

    // Create a spark if this is a wire
    if (this.data.isWire && this.data.place) {
      this.sparkMaterial = new THREE.PointsMaterial({
        map: sparkTextures[THREE.Math.randInt(0, 7)],
        transparent: true,
        // opacity: 1,
        alphaTest: 0.01,
        depthWrite: false,
        size: scale / 2 * window.devicePixelRatio
      })
      var geo = new THREE.Geometry()
      geo.vertices.push(zero)
      this.spark = new THREE.Points(geo, this.sparkMaterial)
      this.spark.renderOrder = 199
      o3d.add(this.spark)
    }

    this.updateDirs(kind)
    updatePipes()
  },
  
  tick: function(t, dt) {
    if (this.checkGoals) {
      const goalsReached = updatePipes()
      // console.log('updatePipes:', goalsReached, sources.length)
      fillSpeedMultiplier = goalsReached === sources.length ? 10 : 1
      if (goalsReached === sources.length) {
        playSound('fill-next')
      }
      // console.log('count goals', countGoals(), sources.length, fillSpeedMultiplier)
      this.checkGoals = false
    }
    
    if (!activeScene) return
    if (!this.geometry) return

    this.tickBubbles(dt)

    if (this.data.isWire && this.data.place) {
      if (this.next || !isInGrid(this.flowTo) || !this.isFilling) {
        this.sparkMaterial.size = this.amount === 1 ? 0.2 * scale / 2 * window.devicePixelRatio : 0
      }
      else {
        this.sparkMaterial.size = this.amount === 1 ? scale / 2 * window.devicePixelRatio : 0

        var sparkY = this.el.object3D.position.y + this.spark.position.y
        if (isPlaying && water.position.y > sparkY) {
          playSound('zap')
          loseGame('You were electrocuted when a live wire touched the liquid')
        }
      }

      if (Math.random() < 0.6) {
        this.sparkMaterial.opacity = Math.min(Math.random() * 2, 1)
        this.sparkMaterial.map = sparkTextures[THREE.Math.randInt(0, 7)]
      }
    }

    if (this.isFilling) {
      this.amount = Math.min(this.amount + 0.003 * this.data.fillSpeed * fillSpeedMultiplier * dt / 1000 * 60, 1);
      // console.log('filling: ', this.el.object3D.position, this.amount)
    }
    if (this.amount - this.lastAmount >= 0.02) { // TODO: check amount
      this.updateDrawRange()
      this.lastAmount = this.amount
      this.updateEndCap()
    }
    else if (this.amount === 1 && this.isFilling && !this.isNextFilling) {
      // Waiting to start filling the next pipe

      this.updateDrawRange()
      this.lastAmount = this.amount
      this.updateEndCap()

      if (this.data.isGoal) {
        this.isFilling = false
        checkWin()
      }
      else {
        var pipe = this.next
        if (pipe) {
          // Update score
          if (isPlacing) {
            var points = 100 + flowBonus
            addToScore(points)

            /* SCORE TEXT
            var el = document.createElement('a-entity')
            el.setAttribute('position', wirePosHelper.copy(this.pos).addScalar(0.5).toArray().join(' '))
            el.setAttribute('material', 'depthTest:false')
            el.setAttribute('score-text', '')
            // el.setAttribute('text', 'width:6;transparent: true; align: center; value: ' + points)
            el.setAttribute('text', 'width:6;align:center;value:' + points)
            document.getElementById('scores').appendChild(el)
            */

            flowBonus += 50
          }

          // Start filling the next pipe
          pipe.isFilling = true
          pipe.amount = 0
          // console.log('setting color', this.data.color)
          pipe.material.color.set(this.data.color)

          var index = pipe.dirs.pipe.indexOf(flipSign(this.dirs.flow[1]))
          pipe.data.isFlowingForward = index === 0
          pipe.updateDirs()
          pipe.data.fillSpeed = this.data.fillSpeed
          pipe.data.color = this.data.color
          
          if (this.el.components.sound) {
            this.el.components.sound.stopSound()
          }

          // Stop filling this pipe
          this.isFilling = false
          this.isNextFilling = true
          if (this.overflow) {
            this.el.object3D.remove(this.overflow.obj.pointCloud)
          }
        }
        else if (!this.data.isWire) {
          // We are overflowing
          if (!this.overflow) {
            flowBonus = 0
            addToScore(0)
          }
          overflow(this, dt)
        }
        else {
          if (!this.el.components.sound) {
            this.el.setAttribute('sound', {src: 'url(' + bzzSound() + ')', loop: true, refDistance, rolloffFactor})
            this.el.components.sound.playSound()
          }
        }
      }
    }
  },

  updateDirs: function() {
    this.dirs = {
      pipe: this.kind.split('>'),
      flow: this.data.isFlowingForward ? this.kind.split('>') : this.kind.split('>').reverse()
    }
    this.pos = this.el.object3D.position.clone().floor()
    this.flowRel = dirToVector[this.dirs.flow[1]]
    this.flowTo = nextCoordHelper.copy(this.pos).add(this.flowRel).clone()

    if (this.spark) {
      this.spark.position.copy(pipeEnds2[this.dirs.flow[1]])
    }
  },

  tickBubbles: function(dt) {
    if (!this.data.isSource || this.spark) return
    updatePointCloud(this.bubbles, dt)
  },

  updatePipes: function() {
    (this.pipes || []).forEach(p => p.next = null)
    this.pipes = []
    var pipe = this
    var dirIn = flipSign(pipe.dirs.flow[1])
    var index
    var i = 0
    while (pipe && !pipe.data.isGoal && i < 30) {
      i++
      pipe.source = this
      this.pipes.push(pipe)
      
      var prev = pipe
      pipe = pipeAt(pipe.flowTo, this)
      if (pipe) {
        index = pipe.dirs.pipe.indexOf(dirIn)
        if (index === -1) break

        prev.next = pipe

        pipe.data.isFlowingForward = index === 0
        pipe.updateDirs()
        pipe.data.fillSpeed = this.data.fillSpeed
        pipe.data.color = this.data.color
        
        dirIn = flipSign(pipe.dirs.pipe[1 - index]) // TODO: min by combining with one above
      }
    }
    this.reachesGoal = index > -1 && pipe && pipe.data.isGoal
  },

  updateEndCap: function() {
    var hidden = this.amount === 0 || this.amount === 1 && !this.isFilling && this.isNextFilling
    this.endCap.visible = !hidden
    if (hidden) return

    var amt = (offs) => this.data.isFlowingForward ? this.amount - offs : 1 - this.amount + offs
    var t = amt(0)
    var tP = amt(0.01)
    // var index = Math.floor(9.99 * t)
    // var tangent = self.frenetFrames.tangents[index]
    // dirHelper.copy(tangent)
    // if (!self.data.isFlowingForward) dirHelper.negate()
    this.fullCurve.getPoint(tP, p2Helper)
    this.fullCurve.getPoint(t, p1Helper)
    this.fullCurve.getPoint(amt(0.005), p0Helper)
    dirHelper.copy(p1Helper).sub(p0Helper).normalize()
    this.endCap.quaternion.setFromUnitVectors(up, dirHelper)
    // self.endCap.quaternion.setFromUnitVectors(up, dirHelper)
    this.endCap.position.copy(p2Helper)
  },

  updateDrawRange: function() {
    var step = 8 * 2 * 3
    var max = 201 * step
    var drawPointCount = Math.floor(this.amount * max / step) * step
    var ff = this.data.isFlowingForward
    this.geometry.setDrawRange(ff ? 0 : max - drawPointCount, ff ? drawPointCount : max)
  },
})


// Bubbles

var crossHelper = new THREE.Vector3()
var bubbleOffsHelper = new THREE.Vector3()

function setBubblePosition(p) {
  var t = clamp(p.t, 0, 999)
  var i = Math.floor(t)
  var pipe = p.source.pipes[i]
  var pt = t % 1
  
  var ft = pipe.data.isFlowingForward ? pt : 1 - pt
  var tangent = pipe.fullCurve.getTangent(ft)
  // TODO: negate if going backward?
  // TODO: fix mem usage
  p.normal = p.normal || pipe.frenetFrames.normals[Math.floor(t / 10)].clone()
  crossHelper.crossVectors(tangent, p.normal)
  p.normal.crossVectors(crossHelper, tangent).normalize()
  bubbleOffsHelper.copy(p.normal).applyAxisAngle(tangent, p.theta).normalize().multiplyScalar(p.r)
  pipe.fullCurve.getPoint(ft, p.position).add(pipe.pos).add(bubbleOffsHelper)
}


// Score text popup component
/* SCORE TEXT

var scoreTextHelper = new THREE.Vector3()

AFRAME.registerComponent('score-text', {
  init: function() {
    var el = this.el
    var pos = el.object3D.position
    var startPos = pos.clone()
    var o = {y: 0, opacity: 1}
    new TWEEN.Tween(o)
      .to({y: 0.125, opacity: 0}, 2000)
      .onUpdate(() => {
        pos.copy(startPos)
        pos.y += o.y
        el.setAttribute('text', {opacity: o.opacity})
      })
      .onComplete(() => el.parentNode.removeChild(el))
      .start()
  },

  tick: function() {
    this.el.object3D.lookAt(this.el.object3D.parent.worldToLocal(cameraWorldPosition))
  }
})
*/


function updatePointCloud(defn, dt) {
  // Set up a new point cloud if needed
  if (!defn.obj) {
    var particles = new Array(defn.count).fill(null).map(defn.create)
    var geometry = new THREE.Geometry()
    particles.forEach(p => geometry.vertices.push(p.position))

    var pointCloud = new THREE.Points(geometry, defn.material)
    pointCloud.renderOrder = defn.renderOrder
    pointCloud.sortParticles = true
    defn.object3D.add(pointCloud)
    defn.obj = {particles, geometry, pointCloud}
  }

  // Update the particles
  for (var i in defn.obj.particles) {
    defn.update(defn.obj.particles[i], dt)
  }
  defn.obj.geometry.verticesNeedUpdate = true
  defn.obj.geometry.computeBoundingSphere()
}


// Overflow

var gravity = new THREE.Vector3(0, -9.8, 0)
// var bouyancy = new THREE.Vector3(0, 8, 0)
var bouyancy = new THREE.Vector3(0, 3, 0)
var accHelper = new THREE.Vector3()
var velHelper = new THREE.Vector3()
var posHelper = new THREE.Vector3()
var xAxis = new THREE.Vector3(1, 0, 0)
var yAxis = new THREE.Vector3(0, 1, 0) // TODO: merge with up

var dirAxes = {
  '+x': '+z',
  '-x': '+z',
  '+y': '+z',
  '-y': '+z',
  '+z': '+x',
  '-z': '+x',
}

var dirAngles = {
  '+x': -1,
  '-x': 1,
  '+y': 0,
  '-y': 2,
  '+z': 1,
  '-z': -1,
}

var worldPosHelper3 = new THREE.Vector3()
var worldPosHelper4 = new THREE.Vector3()
var waterWorldPos = new THREE.Vector3()

var overflowSound = () => jsfxr([3,0.7354,0.1097,0.045,0.4548,0.635,0.0166,0.017,0.0314,0.7644,0.0004,0.2392,,0.5291,-0.1974,,0.0292,0.0366,0.6863,0.0006,0.3234,0.0303,-0.0559,0.5])

function overflow(self, dt) {
  if (self.isGoal) return

  isOverflowing = true
  if (canOverflow) {
    var delta = 0.0003 * self.data.fillSpeed * dt / 1000 * 60
    colorVolumes[self.data.color] = (colorVolumes[self.data.color] || 0) + delta
  }
  
  //

  self.el.object3D.getWorldPosition(worldPosHelper3)

  if (!self.overflow) {
    var dirOut = self.dirs.flow[1]
    var p1 = self.fullCurve.getPoint(self.data.isFlowingForward ? 1 : 0)

    // var id = 'overflow'
    self.overflow = {
      object3D: self.el.object3D,
      count: overflowCount,
      material: new THREE.PointsMaterial({
        color: self.data.color,
        size: overflowSize / 2 * window.devicePixelRatio,
        transparent: true,
        opacity: 0.5,
        alphaTest: 0.4,
        map: dropletTexture
      }),
      renderOrder: 99,
      create: () => ({
        t: Math.random() * 0.5 + 0.5,
        position: dropletPosition(p1, dirOut).clone(),
        velocity: dropletVelocity(self, dirOut).clone(),
      }),
      update: (p, dt) => {
        var dts = dt / 1000
        var worldY = worldPosHelper3.y + p.position.y * scale
        var isUnderwater = worldY.y < waterWorldPosition.y
        accHelper.copy(isUnderwater ? bouyancy : gravity).multiplyScalar(dts)
        var gt = p.t > 0
        p.t = p.t - dts
        if (p.t < 0) {
          p.t = Math.random() * 0.5 + 0.5
          p.position.copy(dropletPosition(p1, dirOut))
          p.velocity.copy(dropletVelocity(self, dirOut))
        }
        if (!isUnderwater) {
          p.velocity.add(accHelper)
        }
        p.velocity.x *= isUnderwater ? 0.95 : 1
        p.velocity.y *= isUnderwater ? 0.8 : 1
        p.velocity.z *= isUnderwater ? 0.95 : 1
        p.position.add(velHelper.copy(p.velocity).multiplyScalar(dts))
      }
    }
    
    self.el.setAttribute('sound', {src: 'url(' + overflowSound() + ')', loop: true, refDistance, rolloffFactor})
    // setTimeout(() => self.el.components.sound.playSound(), 100)
    self.el.components.sound.playSound()
  }

  updatePointCloud(self.overflow, dt)
}

function dropletPosition(p1, dir) {
  return posHelper.set(Math.random() * 0.2 - 0.1, 0, Math.random() * 0.2 - 0.1).applyAxisAngle(dirToVector[dirAxes[dir]], dirAngles[dir] * Math.PI / 2).add(p1)
}

function dropletVelocity(self, dir) {
  var speed = self.data.fillSpeed * 1 + Math.random() * 1.5
  var r1 = Math.random() * Math.PI * 2
  var r2 = Math.random() * Math.PI / 2 / 2 / 2
  return velHelper.set(0, speed, 0).applyAxisAngle(xAxis, r2).applyAxisAngle(yAxis, r1).applyAxisAngle(dirToVector[dirAxes[dir]], dirAngles[dir] * Math.PI / 2)
}


// Water component

var colorHelper = new THREE.Color()
var worldPosHelper2 = new THREE.Vector3()
var isUnderwater
// var waterYScale = 0
var waterYScale = 0.7
var waterLevelGeo = new THREE.PlaneBufferGeometry(12, 12, 12, 12)
var waterLevelMat = new THREE.MeshStandardMaterial({color: waterColor, transparent: true, opacity: 0, side: 2 /* THREE.DoubleSide */})
var waterLevel = createMesh(waterLevelGeo, waterLevelMat, 50)

AFRAME.registerComponent('water', {
  init: function() {
    this.el.object3D.add(waterLevel)
  },

  tick: function(t) {
    if (!canOverflow) return
        
    /* WATER Y SCALE
    const yScaleSpeed = 0.02
    // TODO: 0.7 vs 1?
    waterYScale = isOverflowing ? waterYScale + (0.7 - waterYScale) * yScaleSpeed : waterYScale * (0.7 - yScaleSpeed)
    */
    
    if (isOverflowing) {
      var volume = 0
      for (var color in colorVolumes) {
        volume += colorVolumes[color]
      }

      var r = 0, g = 0, b = 0
      for (var color in colorVolumes) {
        colorHelper.set(parseInt(color))
        var per = colorVolumes[color] / volume
        r += colorHelper.r * per
        g += colorHelper.g * per
        b += colorHelper.b * per
      }
      colorHelper.setRGB(r, g, b)

      var opacity = Math.min(volume, 0.3)
      this.el.object3D.position.y = 0.8 + volume
      waterLevelMat.color.copy(colorHelper)
      waterLevelMat.opacity = opacity * 10 / 3 * 0.7 // 2.333

      if (activeScene === 'intro') {
        this.el.object3D.position.y = Math.min(this.el.object3D.position.y, 1.5)
      }
      else if (isPlaying && this.el.object3D.position.y > levelSize.y + 1) {
        playSound('lose')
        loseGame('You drowned')
      }
    }
    
    isOverflowing = false

    // Update the overflow bonus based on the height of the water
    var calc = clamp(1000 - Math.floor(100 * (this.el.object3D.position.y - 0.81) / 3) * 10, 0, 1000)
    if (calc !== overflowBonus) {
      overflowBonus = calc
      // Trigger a redraw
      addToScore(0)
    }

    var ts = t / 1000 * 20
    var i = 0
    for (var x = 0; x <= 12; x++) {
      for (var y = 0; y <= 12; y++, i++) {
        waterLevelGeo.attributes.position.array[i * 3 + 2] = waterYScale * 0.05 * (Math.sin((x + ts) * 0.3) + Math.sin((y + ts) * 0.5))
      }
    }
    waterLevelGeo.attributes.position.needsUpdate = true

    // Show/hide the underwater overlay depending on if the player is underwater
    if (activeScene && !isFading) {
      isUnderwater = cameraWorldPosition.y < waterWorldPosition.y + 0.05
      if (isUnderwater) {
        fadeMaterial.opacity = 0.85
        fadeMaterial.needsUpdate = true
        fadeMaterial.blending = 4 /* THREE.MultiplyBlending */
      }
      else {
        fadeMaterial.blending = 2 /* THREE.AdditiveBlending */
      }
      fade.visible = isUnderwater
    }
  },
  
  reset: function() {
    this.el.object3D.position.y = 0.7
    waterLevelMat.opacity = 0
    colorVolumes = {}
  }
})


// Generic helpers

function rotate(arr) {
  return arr.push(arr.shift())
}

function clamp(x, min, max) {
  return Math.max(Math.min(x, max), min)
}


// Pipe rotation helpers

var zero = new THREE.Vector3()
var zeroV = {x: 0, y: 0, z: 0}
// TODO: minify
var rotations = {
  'q': {rot: true, rotAlt: false},
  'r': {rot: false, rotAlt: true},
  'e': {rot: false, rotAlt: false},
  'f': {rot: true, rotAlt: true},
}

function dirToAxis(dir, exclude) {
  var x = Math.abs(dir.x)
  var y = Math.abs(dir.y)
  var z = Math.abs(dir.z)
  var xy = x > y
  var yz = y > z
  var xz = x > z
  var X = 0, Y = 0, Z = 0
  if (exclude) {
    if (exclude.x) {
      yz ? (Y = 1) : (Z = 1)
    }
    if (exclude.y) {
      xz ? (X = 1) : (Z = 1)
    }
    if (exclude.z) {
      xy ? (X = 1) : (Y = 1)
    }
  }
  else {
    xy
    ? xz
      ? (X = 1)
      : yz
        ? (Y = 1)
        : (Z = 1)
    : yz
      ? (Y = 1)
      : xz
        ? (X = 1)
        : (Z = 1) 
  }
  return new THREE.Vector3(X * Math.sign(dir.x), Y * Math.sign(dir.y), Z * Math.sign(dir.z))
}


// Give up

var isGivingUp

function giveUp() {
  if (isGivingUp) {
    playSound('lose')
    loseGame('You gave up')
  }
  else {
    isGivingUp = true
    if (isVR) {
      showOverview('Long-press the trackpad again to give up')
    }
    else {
      showOverview('Press L again to give up')
    }
    playSound('warn')
  }
}


function teleport() {
  console.log('teleporting')
  floorCircle.object3D.getWorldPosition(hitWorldHelper)
  setRigPos(hitWorldHelper)
  window.dispatchEvent(new Event('teleported'))
}


// Cursor-target component

var hitWorldHelper = new THREE.Vector3()
var grabTarget
var grabTargetColor
var grabTargetOpacity
var grabTargetCanRemove
var gridPos = new THREE.Vector3()
var trackpadDownAt

const alreadyActiveWarning = 'You already have an active (green) pipe or wire. Snap it into place before grabbing or creating a new one'
const cantPickUpWarning = 'You can only pick up an empty pipe or dead wire'

var pointerTarget = new THREE.Vector3()
var actualPosition = new THREE.Vector3()
var actualQuaternion = new THREE.Quaternion()
var displayQuaternion = new THREE.Quaternion()

var targetVector = new THREE.Vector3()
var isTargetValid
var localQ = new THREE.Quaternion()
var startRot = new THREE.Quaternion()
var grabbedKind

AFRAME.registerComponent('cursor-target', {  
  init: function () {
    this.pipe = document.getElementById('cursor-pipe-container')
    this.pipePipe = document.getElementById('cursor-pipe')
    
    // Build guide box
    this.material = new THREE.LineBasicMaterial()
    this.el.object3D.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry()), this.material))

    // Build guidelines 
    var oneMat = new THREE.LineBasicMaterial({transparent: true, opacity: 0.6})
    this.lines = new THREE.Group()
    var arr = [1, 0, 0]
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 2; j++) {
        var geometry = new THREE.Geometry()
        geometry.vertices.push(zero)
        geometry.vertices.push(new THREE.Vector3(...arr).clone().multiplyScalar(j ? 20 : -20))
        rotate(arr)
        geometry.vertices.push(new THREE.Vector3(...arr).clone().multiplyScalar(.2))
        geometry.vertices.push(new THREE.Vector3(...arr).clone().multiplyScalar(-.2))
        rotate(arr)
        geometry.vertices.push(new THREE.Vector3(...arr).clone().multiplyScalar(.2))
        geometry.vertices.push(new THREE.Vector3(...arr).clone().multiplyScalar(-.2))
        rotate(arr)

        var material = new THREE.LineBasicMaterial({transparent: true, opacity: 0.6})
        var xNeg = new THREE.LineSegments(geometry, material)
        xNeg.position.copy(new THREE.Vector3(...arr).clone().multiplyScalar(j ? 0.5 : -0.5))
        this.lines.add(xNeg)

        rotate(arr)
      }
    }
    this.el.object3D.add(this.lines)

    window.addEventListener('keydown', (evt) => this.rot(evt.key))
    this.el.sceneEl.canvas.addEventListener('mousedown', evt => this.click())
    vrController = document.getElementById('controller')
    vrController.addEventListener('trackpaddown', () => trackpadDownAt = +new Date())
    vrController.addEventListener('trackpadup', () => {
      if (+new Date() - trackpadDownAt > 2000) {
        giveUp()
        return
      }
      else {
        isGivingUp = false
      }

      this.placePipe(false)
    })

    vrController.addEventListener('thumbstickdown', () => trackpadDownAt = +new Date())
    vrController.addEventListener('thumbstickup', () => {
      if (+new Date() - trackpadDownAt > 1000) {
        giveUp()
        return
      }
      else {
        isGivingUp = false
      }

      this.placePipe(false)
    })

    this.el.sceneEl.addEventListener('enter-vr', _ => {
      isVR = true
      rig.position.y = 0.3 * scale
    })
    this.el.sceneEl.addEventListener('exit-vr', _ => {
      isVR = false
      rig.position.y = 2.1
    })
    vrController.addEventListener('triggerup', () => this.triggerUp())
    vrController.addEventListener('triggerdown', () => this.click())
  },

  release: function() {
    window.dispatchEvent(new Event('click-triggered'))

    this.isGrabbing = false
    this.triggerDown = false

    if (!isPlacing) {
      this.clamped = false
      return
    }

    if (!grabbedKind) return

    this.computeKind()
    if (this.clamped) {
      this.placePipe(true)
    }
  },
  
  triggerUp: function() {
    isGivingUp = false
    this.release()
  },
  
  click: function() {
    isGivingUp = false
    window.dispatchEvent(new Event('click-triggered'))

    if (!isPlacing) return

    var pointerWorld = actualPosition

    this.triggerDown = true

    if (grabTarget && !grabbedKind) {
      if (!grabTargetCanRemove) {
        showWarning(cantPickUpWarning)
        return
      }

      var pos = grabTarget.pos
      var pipe = grid[pos.x * 16 * 16 + pos.y * 16 + pos.z].components.pipe
      grabbedKind = pipe.kind
      this.isWire = pipe.data.isWire
      grid[pos.x * 16 * 16 + pos.y * 16 + pos.z] = null
      grabTarget.el.parentNode.removeChild(grabTarget.el)
      grabTarget = null
      updatePipes()
      addToScore(-10)

      this.nextPipe(grabbedKind, this.isWire)
      this.pipe.object3D.position.copy(pos).addScalar(0.5)
      this.isGrabbing = true
    }
    else if (grabTarget) {
      showWarning(alreadyActiveWarning)
      return
    }
    else if (grabbedKind) {
      if (isVR) {
        var pipeWorld = new THREE.Vector3()
        this.pipe.object3D.getWorldPosition(pipeWorld)
        var dist = pipeWorld.distanceTo(pointerWorld)
        console.log('dist', dist, this.clamped)
        this.isGrabbing = dist < 0.5
        if (!this.isGrabbing) {
          showWarning(alreadyActiveWarning)
          return
        }
      }
      else if (!isVR && this.isGrabbing && this.clamped) {
        this.release()
      }
    }
    else {
      this.nextPipe()
      this.pipe.object3D.position.copy(pointerWorld)
      this.pipe.object3D.parent.worldToLocal(this.pipe.object3D.position)
      this.isGrabbing = true
    }

    this.pointer.object3D.updateMatrixWorld()
    var q = new THREE.Quaternion()
    this.pointer.object3D.getWorldQuaternion(q)
    q.inverse().multiply(actualQuaternion)
    startRot.copy(q)
  },

  computeKind: function() {
    var pipe = this.pipePipe.components.pipe
    if (!pipe.kind) {
      return
    }
    
    var axisA = dirToVector[pipe.dirs.pipe[0]].clone()
    var axisB = dirToVector[pipe.dirs.pipe[1]].clone()
    
    var rot = this.pipe.object3D.quaternion

    axisA.applyQuaternion(rot)
    axisB.applyQuaternion(rot)
    
    var dirs = []
    
    var axes = ['x', 'y', 'z']
    for (var i = 0; i < 3; i++) {
      var a = axes[i]
      
      var axis = axisA
      var index = 0
      var dot = axis.dot(dirToVector['+' + a])
      if (Math.abs(dot) > 0.999) {
        dirs[index] = (dot > 0 ? '+' : '-') + a
      }

      axis = axisB
      index = 1
      var dot = axis.dot(dirToVector['+' + a])
      if (Math.abs(dot) > 0.999) {
        dirs[index] = (dot > 0 ? '+' : '-') + a
      }
    }

    this.computedKind = dirs.join('>')
  },
  
  nextPipe: function(kind, isWire) {
    if (!activeScene) return // TODO: needed?

    var kinds = allowedPieces[activeScene]
    grabbedKind = kind || kinds[Math.floor(Math.random() * kinds.length)]
    this.isWire = kind
      ? isWire
      : hasMorePipes
        ? hasMoreWires && sceneAllowsWire[activeScene] ? THREE.Math.randInt(0, 1) === 0 ? false : true : false
        : true
    this.pipe.object3D.rotation.copy(zero)
    this.pipePipe.components.pipe.updateMesh(grabbedKind, this.isWire)
    this.computeKind()
    console.log('computed kind', grabbedKind, this.computedKind)

    window.dispatchEvent(new Event('grab-pipe'))
  },
  
  tick: function () {
    this.lines.visible = !isVR

    if (!isPlaying || !isPlacing) {// || (this.floorCircle.getAttribute('visible') && this.isGrabbing)) {
      this.el.setAttribute('visible', false)
      this.pipe.setAttribute('visible', false)
      return
    }

    this.pipe.setAttribute('visible', !!grabbedKind && (isVR || !grabTarget))

    this.pointer = isVR ? vrController : cameraEl

    // Set target to the hand or mouse target
    var pointer = this.pointer.object3D

    pointer.updateMatrixWorld()
    pointer.getWorldPosition(actualPosition)
    var target = new THREE.Vector3()
    pointer.getWorldDirection(target)
    var dist = isVR ? 0 : -1.25
    target.normalize().multiplyScalar(dist).add(actualPosition) //.multiplyScalar(1 / scale)

    pointerTarget.copy(target)
    
    var notInSelf = cameraWorldPosition.distanceTo(target) > 0.5
    this.el.setAttribute('visible', notInSelf)
    
    if (isVR && this.isGrabbing) {
      // Only needed for isVR6
      pointer.getWorldQuaternion(localQ)
      actualQuaternion.multiplyQuaternions(localQ, startRot)

      // TODO: needed? local and world quaternions should be the same
      // var parentWorldQuaternion = new THREE.Quaternion()
      // this.el.parentNode.object3D.getWorldQuaternion(parentWorldQuaternion).inverse()
      // this.actualQuaternion.multiply(parentWorldQuaternion)
    }

    this.el.object3D.parent.worldToLocal(target)

    //
    this.el.object3D.position.copy(target).floor().clamp(zero, levelSize.clone().addScalar(1)).addScalar(0.5)
    
    //
    var pos = new THREE.Vector3().copy(target).floor().addScalar(0.5)
    var pipePosition = new THREE.Vector3()
    var clampPosition = pos.distanceTo(target) < 0.4
    pipePosition.copy(clampPosition ? pos : target)

    //
    var v = new THREE.Vector3().copy(pipePosition).floor()
    var valid = canPlaceInGrid(v)
    var gridItem = valid && pipeAt(v)
    var canPlace = !gridItem && canPlaceInGrid(v)
    
    this.material.color.set(valid ? 0xffffff : 0xff0000)

    if (!this.isGrabbing) {
      gridPos.copy(target).floor().clamp(zero, levelSize)
      var gridPosMiddle = new THREE.Vector3().copy(gridPos).addScalar(0.5)
      var isCloseEnough = gridPosMiddle.distanceTo(target) < 0.5
      var pipe = pipeAt(gridPos)
      var shouldHighlight = isCloseEnough && pipe && !grabbedKind
      if (shouldHighlight) {
        if (grabTarget) {
          grabTarget.tubeMaterial.color.set(grabTargetColor)
          grabTarget.tubeMaterial.opacity = grabTargetOpacity
          grabTarget = null
        }

        var canRemove = pipe.amount === 0

        grabTarget = pipe
        grabTargetColor = pipe.tubeMaterial.color.clone()
        grabTargetOpacity = pipe.tubeMaterial.opacity
        grabTargetCanRemove = canRemove

        grabTarget.tubeMaterial.color.set(canRemove ? 0x00ff00 : 0xff0000)
        grabTarget.tubeMaterial.opacity = 1
      }
      else {
        if (grabTarget) {
          grabTarget.tubeMaterial.color.set(grabTargetColor)
          grabTarget.tubeMaterial.opacity = grabTargetOpacity
          grabTarget = null
        }
      }

      return
    }
    else {
      if (grabTarget) {
        grabTarget.tubeMaterial.color.set(grabTargetColor)
        grabTarget.tubeMaterial.opacity = grabTargetOpacity
        grabTarget = null
      }
    }

    var clampRotation = !isVR

    displayQuaternion.copy(actualQuaternion)

    var pipePos = new THREE.Vector3()
    pipePos.copy(target).addScalar(0.5)

    var up = yAxis.clone()
    var right = xAxis.clone()
    var upAxis = dirToAxis(up.applyQuaternion(actualQuaternion))
    var rightAxis = dirToAxis(right.applyQuaternion(actualQuaternion), upAxis)
    var zAxis = new THREE.Vector3().crossVectors(rightAxis, upAxis)
    var upAngle = Math.abs(up.angleTo(upAxis))
    var rightAngle = Math.abs(right.angleTo(rightAxis))
    var yClose = upAngle < Math.PI / 2 / 3
    var xClose = rightAngle < Math.PI / 2 / 3
    if ((grabbedKind === '-x>+x' || grabbedKind === '+x>-x') && xClose || (grabbedKind === '-y>+y' || grabbedKind === '+y>-y') && yClose || xClose && yClose) {
      var m = new THREE.Matrix4().makeBasis(rightAxis, upAxis, zAxis)
      displayQuaternion.setFromRotationMatrix(m)
      clampRotation = true
    }

    this.clamped = clampPosition && clampRotation && canPlace
    if (this.clamped) {
      if (isVR) {
        this.pipe.object3D.quaternion.copy(displayQuaternion)
      }
      this.pipe.object3D.position.copy(pipePosition)
      this.pipePipe.components.pipe.tubeMaterial.color.set('#0f0')

      targetVector.copy(pipePosition).floor()    
    }
    else {
      if (isVR) {
        this.pipe.object3D.quaternion.copy(actualQuaternion)
      }
      this.pipe.object3D.position.copy(target).clamp(one.clone(), levelSize.clone().addScalar(1))
      this.pipePipe.components.pipe.tubeMaterial.color.set('#484')
    }

    isTargetValid = valid && this.clamped

    this.computeKind()
    console.log('kind', this.computedKind)
  },
  
  placePipe: function(place) {
    window.dispatchEvent(new Event('click-triggered'))

    if (floorCircle.getAttribute('visible')) {
      teleport()
      return
    }

    if (!place) return

    console.log('placing at', JSON.stringify(targetVector, null, 4))

    if (!isPlaying || !isTargetValid || !canPlaceInGrid(targetVector)) return

    this.computeKind()

    // Create a pipe
    var spawnEl = document.createElement('a-entity')
    spawnEl.setAttribute('position', targetVector.clone())
    spawnEl.setAttribute('pipe', {kind: this.computedKind, isWire: this.isWire, place: true})
    document.getElementById('pipes').appendChild(spawnEl)

    window.dispatchEvent(new Event('place-pipe'))
    playSound('place')

    grabbedKind = null
    this.pipe.setAttribute('visible', false)
  },

  rot: function(letter) {
    if (!isPlaying) return
      
    if (letter === 'l') {
      giveUp()
      return
    }
    else {
      isGivingUp = false
    }
    
    if (!grabbedKind) return
    
    var r = rotations[letter]
    if (!r) return

    var q = new THREE.Quaternion()
    this.pointer.object3D.updateMatrixWorld()
    this.pointer.object3D.getWorldQuaternion(q)

    // TODO: needed? local and world quaternions should be the same
    // var parentWorldQuaternion = new THREE.Quaternion()
    // this.pipe.parentNode.object3D.getWorldQuaternion(parentWorldQuaternion).inverse()
    // q.multiply(parentWorldQuaternion)
    
    var dir = dirToAxis((r.rotAlt ? xAxis : yAxis).clone().applyQuaternion(q))
    var rot = (isVR ? -1 : 1) * (r.rotAlt ? 1 : -1) * (r.rot ? 1 : -1) * Math.PI / 2
    
    if (this.tween) {
      this.tween.end()
    }

    this.pipe.object3D.updateMatrixWorld()
    var qsrc = this.pipe.object3D.quaternion.clone()
    var qdst = new THREE.Quaternion().setFromAxisAngle(dir, rot).multiply(qsrc).normalize()
    var qm = this.pipe.object3D.quaternion
    console.log('before tween', qsrc, qdst, qm)

    var o = {t: 0}
    this.tween = new TWEEN.Tween(o)
      .to({t: 1}, 300)
      .onUpdate(() => THREE.Quaternion.slerp(qsrc, qdst, qm, o.t))
      .start()
  },
})


// Button listener component

var isTouchingTrackpad = false
var targetPointHelper = new THREE.Vector3()
var willTriggerTeleport
var didTriggerRotate
var hasThumbstick

AFRAME.registerComponent('listen-for-button', {
  init: function() {
    this.el.addEventListener('trackpadtouchstart', () => isTouchingTrackpad = true)
    this.el.addEventListener('trackpadtouchend', () => isTouchingTrackpad = false)
    this.el.addEventListener('thumbsticktouchstart', () => hasThumbstick = true)
    this.el.addEventListener('axismove', (event) => {
      if (!hasThumbstick) return
      if (!canTeleport) return
      
      if (Math.abs(event.detail.axis[1]) > 0.8) {
        isTouchingTrackpad = true
        willTriggerTeleport = true
      }
      else if (willTriggerTeleport) {
        teleport()
        willTriggerTeleport = false
      }
      else {
        isTouchingTrackpad = false
      }

      if (event.detail.axis[0] > 0.8) {
        if (!didTriggerRotate) {
          rig.rotation.y -= Math.PI / 4
        }
        didTriggerRotate = true
      }
      else if (event.detail.axis[0] < -0.8) {
        if (!didTriggerRotate) {
          rig.rotation.y += Math.PI / 4
        }
        didTriggerRotate = true
      }
      else {
        didTriggerRotate = false
      }
    })
    this.raycaster = this.el.components.raycaster
  },
  
  tick: function() {
    var isTargeting = false
    if (canTeleport && isVR && isTouchingTrackpad) {
      this.raycaster.updateOriginDirection()
      this.raycaster.raycaster.far = 4 * scale
      var int = this.raycaster.raycaster.intersectObject(floor.object3D, true)[0]
      if (int) {
        var s = new THREE.Vector3()
        targetPointHelper.copy(int.point).clamp(one.clone().addScalar(0.6).multiplyScalar(scale), s.copy(levelSize).addScalar(.4).multiplyScalar(scale))
        targetPointHelper.y = 0.81 * scale
        if (int.distance < 5) { // TODO: needed?
          floorCircle.setAttribute('position', targetPointHelper)
          isTargeting = true
        }
      }
    }
    floorCircle.setAttribute('visible', isTargeting)
  },
})


// Game component

var newPosHelper = new THREE.Vector3()
var cameraWorldPosition = new THREE.Vector3()
var waterWorldPosition = new THREE.Vector3()
var telPosHelper = new THREE.Vector3()

AFRAME.registerComponent('game', {
  init: function() {
    setupHandles()
    
    // Setup fade
    fadeEl.object3DMap.mesh.renderOrder = 199
    fadeMaterial.blending = 2 /* THREE.AdditiveBlending */

    ;[textEl, document.getElementById('instructions')].forEach(el => {
      el.object3DMap.text.renderOrder = 999
      el.object3DMap.text.material.depthTest = false
    })

    // Get globally-used positions
    camera.getWorldPosition(cameraWorldPosition)
    water.getWorldPosition(waterWorldPosition)
    
    // Start game
    startIntroRoom()
  },

  tick: function() {
    // Get globally-used positions
    camera.getWorldPosition(cameraWorldPosition)
    water.getWorldPosition(waterWorldPosition)
    
    if (activeScene) {
      // Limit movement within the level
      if (!isVR) {
        newPosHelper.copy(rig.position).clamp(one, scaledLevelSize)
        newPosHelper.y = rig.position.y
        if (rig.position.distanceTo(newPosHelper) > 0.001) {
          console.log('limit')
          rig.position.copy(newPosHelper)
        }
      }

      // Teleport to start the game if we are at the teleporter
      if (!isGameStarted) {
        var cameraLocal = new THREE.Vector3().copy(cameraWorldPosition)
        level.object3D.parent.worldToLocal(cameraLocal)
        cameraLocal.y = teleporter.position.y
        if (teleporter.position.distanceTo(cameraLocal) < 0.8) {
          window.dispatchEvent(new Event('start-game'))
        }
      }
    }
  },
})
