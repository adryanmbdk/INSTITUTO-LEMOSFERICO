// Each stop marks the opening light of a section. Interpolation follows narrative time.
const stops = [
  ['#625279','#cb7882','#ffa277','#ffe3a0','#eca675'],
  ['#296c85','#68abae','#b2d9c2','#f5e6af','#c0d0ac'],
  ['#774367','#cf5d55','#fb914b','#ffd07b','#e59466'],
  ['#37395f','#745077','#bc667d','#f6a584','#cd8492'],
  ['#111c36','#1d3651','#305269','#568082','#385b68'],
  ['#2c3556','#525171','#937087','#de9f91','#ae8391'],
]
// Scattered daylight, cloud cover and visibility also shape the background itself.
const atmospheres = {
  clear: { cast: ['#ffffff','#ffffff'], tint: 0, disc: 1, stars: 1 },
  fog: { cast: ['#b8bfbd','#d5d3c8'], tint: .85, disc: .17, stars: .015 },
  cloudy: { cast: ['#728493','#c4c6c0'], tint: .70, disc: .38, stars: .14 },
  rain: { cast: ['#465969','#a3acab'], tint: .87, disc: .10, stars: .025 },
  storm: { cast: ['#263443','#62717e'], tint: .95, disc: .025, stars: 0 },
  snow: { cast: ['#a2afbf','#e1e5e5'], tint: .83, disc: .21, stars: .04 },
}
const phases = ['dawn','day','sunset','twilight','night','late']
const orbit = [0,.12,.37,.50,.58,.84,1]
const tau = 2 * Math.PI
const mix = (a,b,t) => a + (b-a)*t
function blend(a,b,t) {
  const channels = [1,3,5].map(i => Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)))
  return '#' + channels.map(n => n.toString(16).padStart(2,'0')).join('')
}
function bloom(c,x,y,rx,ry,inner,outer,opacity) {
  c.save()
  c.translate(x,y)
  c.scale(rx,ry)
  c.globalAlpha=opacity
  const light=c.createRadialGradient(0,0,0,0,0,1)
  light.addColorStop(0,inner); light.addColorStop(.36,outer); light.addColorStop(1,outer.slice(0,7)+'00')
  c.fillStyle=light
  c.fillRect(-1,-1,2,2)
  c.restore()
}
function hash(x,y) {
  const n = Math.sin(x*127.1+y*311.7)*43758.5453
  return n-Math.floor(n)
}
function noise(x,y,period) {
  const i=Math.floor(x), j=Math.floor(y)
  let a=x-i,b=y-j
  a=a*a*(3-2*a)
  b=b*b*(3-2*b)
  return mix(mix(hash(i%period,j),hash((i+1)%period,j),a),mix(hash(i%period,j+1),hash((i+1)%period,j+1),a),b)
}
let texture
function clouds() {
  if(texture) return texture
  texture=document.createElement('canvas')
  texture.width=512
  texture.height=160
  const c=texture.getContext('2d'), pixels=c.createImageData(512,160)
  for(let y=0;y<160;y++) for(let x=0;x<512;x++) {
    let density=0
    for(let k=0;k<5;k++){
      const scale=4*2**k
      density+=noise(x/512*scale,y/210*scale,scale)*(.52/2**k)
    }
    const edge=Math.sin(Math.PI*y/160)**.8
    const i=(y*512+x)*4
    const light=115+density*118-y*.16
    pixels.data.set([light,light+2,light+8,Math.min(255,Math.max(0,(density-.30)*600))*edge],i)
  }
  c.putImageData(pixels,0,0)
  return texture
}
function veil(c,w,y,h,t,alpha) {
  const offset=((t%1+1)%1)*w
  c.globalAlpha=alpha
  c.drawImage(clouds(),offset-w,y,w+1,h)
  c.drawImage(clouds(),offset,y,w+1,h)
  c.globalAlpha=1
}
// Screen-printed silhouettes: a long flat base with a separately inked crown.
const cloudPrints = [
  ['M0 22 Q8 19 22 18 Q28 11 37 13 Q41 6 51 8 Q58 0 68 5 Q75 6 78 12 Q89 11 93 16 L100 19 Q81 21 67 20 L82 23 L47 24 L55 26 Q24 26 0 22Z',
   'M22 18 Q28 11 37 13 Q41 6 51 8 Q58 0 68 5 Q75 6 78 12 Q70 7 63 9 Q56 7 51 12 Q43 10 37 16Z'],
  ['M0 19 L16 16 Q23 11 32 13 Q40 6 51 10 Q57 4 67 8 Q71 10 74 13 L90 15 L83 17 L100 19 L65 20 L77 22 Q40 24 21 20Z',
   'M16 16 Q23 11 32 13 Q40 6 51 10 Q57 4 67 8 Q60 7 54 13 Q41 10 33 15Z'],
].map(parts => parts.map(path => new Path2D(path)))
const banks = [
  [-.17,.06,.56,.24,0], [.74,.17,.42,.17,1], [.28,.23,.19,.065,1],
  [.46,.52,.35,.09,0], [-.09,.57,.38,.10,1], [.78,.66,.33,.07,1],
  [.18,.72,.23,.043,1], [.53,.76,.19,.033,0],
]
function drawCloudPrints(c,w,h,seconds,overcast,fog,palette) {
  const shadow = blend(palette[0],palette[2],mix(.43,.22,overcast))
  for (const [x,y,width,height,shape] of banks) {
    const drift = (seconds*(.00065+y*.0006))%1
    const left = ((x+drift+1)%1)*w
    for (const offset of [left-w,left]) {
      if (offset + width*w < 0) continue
      c.save()
      c.translate(offset,y*h)
      c.scale(width*w/100,height*h*(1+.55*overcast)/30)
      c.globalAlpha = .54+.21*overcast-.44*fog
      c.fillStyle = blend(shadow,palette[3],y*.63)
      c.fill(cloudPrints[shape][0])
      c.fillStyle = blend(palette[2],palette[3],.54)
      c.fill(cloudPrints[shape][1])
      c.restore()
    }
  }
}
let paper
function paperGrain(c) {
  if (!paper) {
    const tile = document.createElement('canvas')
    tile.width = tile.height = 96
    const pen = tile.getContext('2d')
    const pixels = pen.createImageData(96,96)
    for (let i=0;i<pixels.data.length;i+=4) {
      const value = hash(i,75)
      pixels.data.fill(value>.5 ? 255 : 0,i,i+3)
      pixels.data[i+3] = Math.round(12*Math.abs(2*value-1))
    }
    pen.putImageData(pixels,0,0)
    paper = c.createPattern(tile,'repeat')
  }
  return paper
}
const weatherTypes = Object.keys(atmospheres)
export function weatherAt(transition,target,time) {
  const weights = Object.fromEntries(weatherTypes.map(type => [type,Number(type===target)]))
  if (!transition.target) {
    Object.assign(transition,{target,from:weights,start:time})
  } else if (transition.target!==target) {
    const from=weatherAt(transition,transition.target,time)
    Object.assign(transition,{target,from,start:time})
  }
  const t=Math.max(0,Math.min(1,(time-transition.start)/9000))
  const eased=t*t*(3-2*t)
  for (const type of weatherTypes) weights[type]=mix(transition.from[type],weights[type],eased)
  return weights
}
export function precipitation(weight) {
  return Math.max(0,(weight-.10)/.90)**1.45
}
export function drawLandscape(c,section,progress,w,h,seconds,moon,weights) {
  const i=Math.max(0,phases.indexOf(section.sky)), next=(i+1)%6
  const angle=mix(orbit[i],orbit[i+1],progress)*tau
  const horizon=h*.82
  const active=weatherTypes.filter(type=>weights[type]>0)
  const weighted=key=>active.reduce((sum,type)=>sum+weights[type]*atmospheres[type][key],0)
  const atmosphere={tint:weighted('tint'),stars:weighted('stars'),disc:weighted('disc')}
  const sunHeight=Math.sin(angle)
  const darkness=Math.max(0,-sunHeight)
  const nightfall=Math.min(1, Math.max(0, (.08-sunHeight)*2))
  const sky=c.createLinearGradient(0,0,0,h)
  const heights=[0,.36,.64,.84,1]
  const palette=[]
  heights.forEach((height,k)=>{
    const clear=blend(stops[i][k],stops[next][k],progress)
    let color=clear, accumulated=0
    for (const type of active) {
      const {cast,tint}=atmospheres[type]
      const shade=blend(blend(cast[0],cast[1],height),blend('#253045','#495366',height),nightfall)
      accumulated+=weights[type]
      color=blend(color,blend(clear,shade,tint),weights[type]/accumulated)
    }
    palette.push(color)
    sky.addColorStop(height,palette[k])
  })
  c.fillStyle=sky
  c.fillRect(0,0,w,h)
  const sunX=w*(.5-.34*Math.cos(angle))
  const sunsetLight=Math.max(0,1-Math.abs(sunHeight)*.92)*(1-nightfall)
  bloom(c,sunX,horizon,w*.67,h*.62,'#ffdda7','#ffc08c77',sunsetLight*(1-atmosphere.tint*.88))
  for(let j=0;j<95;j++){
    c.fillStyle='rgba(249,242,221,'+darkness*atmosphere.stars*(.25+.65*hash(j,3))+')'
    c.beginPath()
    c.arc(hash(j,1)*w,hash(j,2)*horizon,.5+hash(j,4)*.9,0,tau)
    c.fill()
  }
  function body(isMoon){
    const a=angle+(isMoon?Math.PI:0)
    const x=w*(.5-.34*Math.cos(a)), y=horizon-Math.sin(a)*h*.60
    const r=Math.min(w,h)*(isMoon?.038:.064)
    const altitude=Math.sin(a)
    if(altitude < -.035 || (isMoon && moon==='new')) return
    const visibility=Math.min(1,Math.max(0,(altitude+.035)/.13))
    const tint=isMoon?'#d9e4f1':'#ffe1a0'
    const diffuse=1-atmosphere.disc
    bloom(c,x,y,r*(7+6*diffuse),r*(6+5*diffuse),tint,tint+'58',visibility*(isMoon?.18:.46)*(1-diffuse*.55))
    c.save()
    c.globalAlpha=visibility*atmosphere.disc
    const surface=c.createLinearGradient(x-r,y-r,x+r*.5,y+r)
    surface.addColorStop(0,isMoon?'#f5efe0':'#fff8db')
    surface.addColorStop(.58,isMoon?'#deded9':'#ffebba')
    surface.addColorStop(1,isMoon?'#bac5d0':'#ffd697')
    c.fillStyle=surface
    c.beginPath()
    if(isMoon && moon!=='full'){
      const side=moon==='waning'?-1:1
      c.translate(x,y); c.scale(side,1)
      c.arc(0,0,r,-Math.PI/2,Math.PI/2)
      c.ellipse(0,0,r*.48,r,0,Math.PI/2,-Math.PI/2,true)
    }else c.arc(x,y,r,0,tau)
    c.fill()
    if(isMoon){
      c.clip()
      for(let k=0;k<22;k++){
        const px=(moon==='full'?x:0)+(hash(k,91)-.5)*2*r
        const py=(moon==='full'?y:0)+(hash(k,92)-.5)*2*r
        const size=r*(.09+.32*hash(k,93))
        bloom(c,px,py,size,size*.78,'#6e8094','#8998a644',visibility*atmosphere.disc*.12)
      }
    }
    c.restore()
  }
  body(false); body(true)
  const overcast=weights.cloudy+weights.rain+weights.storm+weights.snow
  drawCloudPrints(c,w,h,seconds,overcast,weights.fog,palette)
  if(overcast){
    c.save()
    c.globalCompositeOperation='soft-light'
    veil(c,w,-h*.30,h*1.26,seconds/255,.91*overcast)
    veil(c,w,h*.04,h*.64,-seconds/340+.41,.64*overcast)
    c.restore()
  }
  // Atmospheric light dissolves the horizon into the lower sky.
  const air=c.createLinearGradient(0,h*.71,0,h)
  air.addColorStop(0,'#ece0d400')
  air.addColorStop(.42,'rgba(232,219,203,'+(.14-.10*darkness)+')')
  air.addColorStop(1,'rgba(114,123,143,'+(.19-.09*darkness)+')')
  c.fillStyle=air
  c.fillRect(0,h*.71,w,h*.29)
  if(weights.fog){
    c.save()
    c.globalCompositeOperation='soft-light'
    veil(c,w,-h*.08,h*.89,seconds/180,.50*weights.fog**1.5)
    veil(c,w,h*.33,h*.79,-seconds/150+.32,.76*weights.fog)
    c.restore()

  }
  for(const weather of ['rain','snow']){
    const intensity=precipitation(weights[weather]+(weather==='rain' ? weights.storm : 0))
    if (!intensity) continue
    const snow=weather==='snow'
    const count=Math.ceil(Math.min(450,w*h/1500)*(1+(snow ? 0 : .8*weights.storm)))
    for(let j=0;j<count;j++){
      const opacity=Math.min(1,Math.max(0,(intensity-hash(j,53)*.92)/.08))
      if (!opacity) continue
      const depth=.3+.7*hash(j,17)
      const fall=(hash(j,11)+seconds*depth*(snow?.075:.93))%1
      const y=fall*(h+24)-12
      const shift=snow?Math.sin(seconds*.6+j)*12+seconds*depth*6:-fall*h*(.15+.22*weights.storm)
      const x=((hash(j,12)*w+shift)%w+w)%w
      c.beginPath()
      if(snow){
        c.fillStyle='rgba(252,252,246,'+opacity*(.35+.6*depth)+')'
        c.arc(x,y,depth*2.8,0,tau); c.fill()
      }else{
        c.strokeStyle='rgba(210,229,240,'+opacity*(.18+.40*depth)+')'
        c.lineWidth=.5+depth
        c.moveTo(x,y); c.lineTo(x-(2.8+6*weights.storm)*depth,y+(18+7*weights.storm)*depth); c.stroke()
      }
    }
  }
  c.fillStyle=paperGrain(c)
  c.fillRect(0,0,w,h)
}
