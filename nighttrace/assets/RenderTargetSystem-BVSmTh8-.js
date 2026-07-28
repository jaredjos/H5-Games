import{A as e,B as t,D as n,E as r,L as i,M as a,N as o,O as s,P as c,R as l,T as u,a as d,c as f,h as p,k as m,m as h,o as g,p as _,s as ee,u as te,v,w as y,y as ne,z as b}from"./Geometry-DzB2TO-e.js";import{d as x,f as re,h as ie,i as ae,l as S,m as oe,n as se,r as C,s as w,t as ce,u as T,v as le}from"./Filter-B_p90UOL.js";import{n as ue,p as E}from"./GCManagedHash-BA8dr6Vl.js";var D=class{constructor(e){this._renderer=e}updateRenderable(){}destroyRenderable(){}validateRenderable(){return!1}addRenderable(e,t){this._renderer.renderPipes.batch.break(t),t.add(e)}execute(e){e.isRenderable&&e.render(this._renderer)}destroy(){this._renderer=null}};D.extension={type:[b.WebGLPipes,b.WebGPUPipes,b.CanvasPipes],name:`customRender`};var O=class{constructor(){this.batcherName=`default`,this.topology=`triangle-list`,this.attributeSize=4,this.indexSize=6,this.packAsQuad=!0,this.roundPixels=0,this._attributeStart=0,this._batcher=null,this._batch=null}get blendMode(){return this.renderable.groupBlendMode}get color(){return this.renderable.groupColorAlpha}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.bounds=null}destroy(){this.reset()}};function k(e,t){let n=e.instructionSet,r=n.instructions;for(let e=0;e<n.instructionSize;e++){let n=r[e];t[n.renderPipeId].execute(n)}}var A=class{constructor(e){this._renderer=e}addRenderGroup(e,t){e.isCachedAsTexture?this._addRenderableCacheAsTexture(e,t):this._addRenderableDirect(e,t)}execute(e){e.isRenderable&&(e.isCachedAsTexture?this._executeCacheAsTexture(e):this._executeDirect(e))}destroy(){this._renderer=null}_addRenderableDirect(e,t){this._renderer.renderPipes.batch.break(t),e._batchableRenderGroup&&=(r.return(e._batchableRenderGroup),null),t.add(e)}_addRenderableCacheAsTexture(e,t){let n=e._batchableRenderGroup??=r.get(O);n.renderable=e.root,n.transform=e.root.relativeGroupTransform,n.texture=e.texture,n.bounds=e._textureBounds,t.add(e),this._renderer.renderPipes.blendMode.pushBlendMode(e,e.root.groupBlendMode,t),this._renderer.renderPipes.batch.addToBatch(n,t),this._renderer.renderPipes.blendMode.popBlendMode(t)}_executeCacheAsTexture(e){if(e.textureNeedsUpdate){e.textureNeedsUpdate=!1;let t=new o().translate(-e._textureBounds.x,-e._textureBounds.y);this._renderer.renderTarget.push(e.texture,!0,null,e.texture.frame),this._renderer.globalUniforms.push({worldTransformMatrix:t,worldColor:4294967295,offset:{x:0,y:0}}),k(e,this._renderer.renderPipes),this._renderer.renderTarget.finishRenderPass(),this._renderer.renderTarget.pop(),this._renderer.globalUniforms.pop()}e._batchableRenderGroup._batcher.updateElement(e._batchableRenderGroup),e._batchableRenderGroup._batcher.geometry.buffers[0].update()}_executeDirect(e){this._renderer.globalUniforms.push({worldTransformMatrix:e.inverseParentTextureTransform,worldColor:e.worldColorAlpha}),k(e,this._renderer.renderPipes),this._renderer.globalUniforms.pop()}};A.extension={type:[b.WebGLPipes,b.WebGPUPipes,b.CanvasPipes],name:`renderGroup`};var j=class{constructor(e){this._renderer=e}addRenderable(e,t){let n=this._getGpuSprite(e);e.didViewUpdate&&this._updateBatchableSprite(e,n),this._renderer.renderPipes.batch.addToBatch(n,t)}updateRenderable(e){let t=this._getGpuSprite(e);e.didViewUpdate&&this._updateBatchableSprite(e,t),t._batcher.updateElement(t)}validateRenderable(e){let t=this._getGpuSprite(e);return!t._batcher.checkAndUpdateTexture(t,e._texture)}_updateBatchableSprite(e,t){t.bounds=e.visualBounds,t.texture=e._texture}_getGpuSprite(e){return e._gpuData[this._renderer.uid]||this._initGPUSprite(e)}_initGPUSprite(e){let t=new O;return t.renderable=e,t.transform=e.groupTransform,t.texture=e._texture,t.bounds=e.visualBounds,t.roundPixels=this._renderer._roundPixels|e._roundPixels,e._gpuData[this._renderer.uid]=t,t}destroy(){this._renderer=null}};j.extension={type:[b.WebGLPipes,b.WebGPUPipes,b.CanvasPipes],name:`sprite`};var M=class e{constructor(e,t){this.state=se.for2d(),this._batchersByInstructionSet=Object.create(null),this._activeBatches=Object.create(null),this.renderer=e,this._adaptor=t,this._adaptor.init?.(this)}static getBatcher(e,t){return new this._availableBatchers[e]({maxTextures:t})}buildStart(e){let t=this._batchersByInstructionSet[e.uid];t||(t=this._batchersByInstructionSet[e.uid]=Object.create(null),t.default||=new ue({maxTextures:this.renderer.limits.maxBatchableTextures})),this._activeBatches=t,this._activeBatch=this._activeBatches.default;for(let e in this._activeBatches)this._activeBatches[e].begin()}addToBatch(t,n){if(this._activeBatch.name!==t.batcherName){this._activeBatch.break(n);let r=this._activeBatches[t.batcherName];r||(r=this._activeBatches[t.batcherName]=e.getBatcher(t.batcherName,this.renderer.limits.maxBatchableTextures),r.begin()),this._activeBatch=r}this._activeBatch.add(t)}break(e){this._activeBatch.break(e)}buildEnd(e){this._activeBatch.break(e);let t=this._activeBatches;for(let e in t){let n=t[e],r=n.geometry;r.indexBuffer.setDataWithSize(n.indexBuffer,n.indexSize,!0),r.buffers[0].setDataWithSize(n.attributeBuffer.float32View,n.attributeSize,!1)}}upload(e){let t=this._batchersByInstructionSet[e.uid];for(let e in t){let n=t[e],r=n.geometry;n.dirty&&(n.dirty=!1,r.buffers[0].update(n.attributeSize*4))}}execute(e){if(e.action===`startBatch`){let t=e.batcher,n=t.geometry,r=t.shader;this._adaptor.start(this,n,r)}this._adaptor.execute(this,e)}destroy(){this.state=null,this.renderer=null,this._adaptor=null;for(let e in this._activeBatches)this._activeBatches[e].destroy();this._activeBatches=null}};M.extension={type:[b.WebGLPipes,b.WebGPUPipes,b.CanvasPipes],name:`batch`},M._availableBatchers=Object.create(null);var N=M;t.handleByMap(b.Batcher,N._availableBatchers),t.add(ue);var de=`in vec2 vMaskCoord;
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;

uniform float uAlpha;
uniform vec4 uMaskClamp;
uniform float uInverse;
uniform float uChannel;

out vec4 finalColor;

void main(void)
{
    float clip = step(3.5,
        step(uMaskClamp.x, vMaskCoord.x) +
        step(uMaskClamp.y, vMaskCoord.y) +
        step(vMaskCoord.x, uMaskClamp.z) +
        step(vMaskCoord.y, uMaskClamp.w));

    // TODO look into why this is needed
    float npmAlpha = uAlpha;
    vec4 original = texture(uTexture, vTextureCoord);
    vec4 masky = texture(uMaskTexture, vMaskCoord);

    float a;
    if (uChannel == 1.0) {
        a = masky.a * npmAlpha * clip;
    } else {
        float alphaMul = 1.0 - npmAlpha * (1.0 - masky.a);
        a = alphaMul * masky.r * npmAlpha * clip;
    }

    if (uInverse == 1.0) {
        a = 1.0 - a;
    }

    finalColor = original * a;
}
`,fe=`in vec2 aPosition;

out vec2 vTextureCoord;
out vec2 vMaskCoord;


uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uFilterMatrix;

vec4 filterVertexPosition(  vec2 aPosition )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
       
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(  vec2 aPosition )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

vec2 getFilterCoord( vec2 aPosition )
{
    return  ( uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;
}   

void main(void)
{
    gl_Position = filterVertexPosition(aPosition);
    vTextureCoord = filterTextureCoord(aPosition);
    vMaskCoord = getFilterCoord(aPosition);
}
`,pe=`struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct MaskUniforms {
  uFilterMatrix:mat3x3<f32>,
  uMaskClamp:vec4<f32>,
  uAlpha:f32,
  uInverse:f32,
  uChannel:f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler : sampler;

@group(1) @binding(0) var<uniform> filterUniforms : MaskUniforms;
@group(1) @binding(1) var uMaskTexture: texture_2d<f32>;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) filterUv : vec2<f32>,
};

fn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>
{
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

fn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);
}

fn getFilterCoord(aPosition:vec2<f32> ) -> vec2<f32>
{
  return ( filterUniforms.uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;
}

fn getSize() -> vec2<f32>
{
  return gfu.uGlobalFrame.zw;
}

@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>,
) -> VSOutput {
  return VSOutput(
   filterVertexPosition(aPosition),
   filterTextureCoord(aPosition),
   getFilterCoord(aPosition)
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) filterUv: vec2<f32>,
  @builtin(position) position: vec4<f32>
) -> @location(0) vec4<f32> {

    var maskClamp = filterUniforms.uMaskClamp;
    var uAlpha = filterUniforms.uAlpha;

    var clip = step(3.5,
      step(maskClamp.x, filterUv.x) +
      step(maskClamp.y, filterUv.y) +
      step(filterUv.x, maskClamp.z) +
      step(filterUv.y, maskClamp.w));

    var mask = textureSample(uMaskTexture, uSampler, filterUv);
    var source = textureSample(uTexture, uSampler, uv);

    var a: f32;
    if (filterUniforms.uChannel == 1.0) {
        a = mask.a * uAlpha * clip;
    } else {
        var alphaMul = 1.0 - uAlpha * (1.0 - mask.a);
        a = alphaMul * mask.r * uAlpha * clip;
    }

    if (filterUniforms.uInverse == 1.0) {
        a = 1.0 - a;
    }

    return source * a;
}
`,me=class extends ce{constructor(e){let{sprite:t,...n}=e,r=new p(t.texture),i=new d({uFilterMatrix:{value:new o,type:`mat3x3<f32>`},uMaskClamp:{value:r.uClampFrame,type:`vec4<f32>`},uAlpha:{value:1,type:`f32`},uInverse:{value:+!!e.inverse,type:`f32`},uChannel:{value:+(e.channel===`alpha`),type:`f32`}}),a=f.from({vertex:{source:pe,entryPoint:`mainVertex`},fragment:{source:pe,entryPoint:`mainFragment`}}),s=te.from({vertex:fe,fragment:de,name:`mask-filter`});super({...n,gpuProgram:a,glProgram:s,clipToViewport:!1,resources:{filterUniforms:i,uMaskTexture:t.texture.source}}),this.sprite=t,this._textureMatrix=r}set inverse(e){this.resources.filterUniforms.uniforms.uInverse=+!!e}get inverse(){return this.resources.filterUniforms.uniforms.uInverse===1}set channel(e){this.resources.filterUniforms.uniforms.uChannel=+(e===`alpha`)}get channel(){return this.resources.filterUniforms.uniforms.uChannel===1?`alpha`:`red`}apply(e,t,n,r){this._textureMatrix.texture=this.sprite.texture,e.calculateSpriteMatrix(this.resources.filterUniforms.uniforms.uFilterMatrix,this.sprite).prepend(this._textureMatrix.mapCoord),this.resources.uMaskTexture=this.sprite.texture.source,e.applyFilter(this,t,n,r)}},he=new y,ge=class extends le{constructor(){super(),this.filters=[new me({sprite:new ae(h.EMPTY),inverse:!1,resolution:`inherit`,antialias:`inherit`})]}get sprite(){return this.filters[0].sprite}set sprite(e){this.filters[0].sprite=e}get inverse(){return this.filters[0].inverse}set inverse(e){this.filters[0].inverse=e}get channel(){return this.filters[0].channel}set channel(e){this.filters[0].channel=e}},P=class{constructor(e){this._activeMaskStage=[],this._renderer=e}push(e,t,n){let r=this._renderer;if(r.renderPipes.batch.break(n),n.add({renderPipeId:`alphaMask`,action:`pushMaskBegin`,mask:e,inverse:t._maskOptions.inverse,canBundle:!1,maskedContainer:t}),e.inverse=t._maskOptions.inverse,e.channel=t._maskOptions.channel??`red`,e.renderMaskToTexture){let t=e.mask;t.includeInBuild=!0,t.collectRenderables(n,r,null),t.includeInBuild=!1}r.renderPipes.batch.break(n),n.add({renderPipeId:`alphaMask`,action:`pushMaskEnd`,mask:e,maskedContainer:t,inverse:t._maskOptions.inverse,canBundle:!1})}pop(e,t,n){this._renderer.renderPipes.batch.break(n),n.add({renderPipeId:`alphaMask`,action:`popMaskEnd`,mask:e,inverse:t._maskOptions.inverse,canBundle:!1})}execute(e){let t=this._renderer,n=e.mask.renderMaskToTexture;if(e.action===`pushMaskBegin`){let i=r.get(ge);if(i.inverse=e.inverse,i.channel=e.mask.channel,n){e.mask.mask.measurable=!0;let n=ie(e.mask.mask,!0,he);e.mask.mask.measurable=!1,n.ceil();let r=t.renderTarget.renderTarget.colorTexture.source,a=x.getOptimalTexture(n.width,n.height,r._resolution,r.antialias);t.renderTarget.push(a,!0),t.globalUniforms.push({offset:n,worldColor:4294967295});let o=i.sprite;o.texture=a,o.worldTransform.tx=n.minX,o.worldTransform.ty=n.minY,this._activeMaskStage.push({filterEffect:i,maskedContainer:e.maskedContainer,filterTexture:a})}else i.sprite=e.mask.mask,this._activeMaskStage.push({filterEffect:i,maskedContainer:e.maskedContainer})}else if(e.action===`pushMaskEnd`){let e=this._activeMaskStage[this._activeMaskStage.length-1];n&&(t.type===g.WEBGL&&t.renderTarget.finishRenderPass(),t.renderTarget.pop(),t.globalUniforms.pop()),t.filter.push({renderPipeId:`filter`,action:`pushFilter`,container:e.maskedContainer,filterEffect:e.filterEffect,canBundle:!1})}else if(e.action===`popMaskEnd`){t.filter.pop();let e=this._activeMaskStage.pop();n&&x.returnTexture(e.filterTexture),r.return(e.filterEffect)}}destroy(){this._renderer=null,this._activeMaskStage=null}};P.extension={type:[b.WebGLPipes,b.WebGPUPipes,b.CanvasPipes],name:`alphaMask`};function F(e,t,n){let r=(e>>24&255)/255;t[n++]=(e&255)/255*r,t[n++]=(e>>8&255)/255*r,t[n++]=(e>>16&255)/255*r,t[n++]=r}var I={};t.handle(b.BlendMode,e=>{if(!e.name)throw Error(`BlendMode extension must have a name property`);I[e.name]=e.ref},e=>{delete I[e.name]});var L=class{constructor(e){this._blendModeStack=[],this._isAdvanced=!1,this._filterHash=Object.create(null),this._renderer=e,this._renderer.runners.prerender.add(this)}prerender(){this._activeBlendMode=`normal`,this._isAdvanced=!1}pushBlendMode(e,t,n){this._blendModeStack.push(t),this.setBlendMode(e,t,n)}popBlendMode(e){this._blendModeStack.pop();let t=this._blendModeStack[this._activeBlendMode.length-1]??`normal`;this.setBlendMode(null,t,e)}setBlendMode(e,t,n){let r=e instanceof T;if(this._activeBlendMode===t){this._isAdvanced&&e&&!r&&this._renderableList?.push(e);return}this._isAdvanced&&this._endAdvancedBlendMode(n),this._activeBlendMode=t,e&&(this._isAdvanced=!!I[t],this._isAdvanced&&this._beginAdvancedBlendMode(e,n))}_beginAdvancedBlendMode(e,t){this._renderer.renderPipes.batch.break(t);let n=this._activeBlendMode;if(!I[n]){s(`Unable to assign BlendMïnx¶‰žËkºwµçUI•Í½ÕÉ”±Ñ¡¥Ì¥ô¤±Ñ¡¥Ì¹}µ…¹…•‘I•Í½ÕÉ•Ì¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}µ…¹…•‘I•Í½ÕÉ•!…Í¡•Ì¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}µ…¹…•‘½±±•Ñ¥½¹Ì¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}É•¹‘•É•Èõ¹Õ±±õôíÄ¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”é€±ÁÉ¥½É¥ÑäèÁô±Ä¹‘•™…Õ±Ñ=ÁÑ¥½¹ÌõíÑ¥Ù”è„À±5…áU¹ÕÍ•‘Q¥µ”èÙ”Ð±É•ÅÕ•¹äèÍ”ÑôíÙ…È]”õÄ±”õ±…ÍÍí½¹ÍÑÉÕÑ½È¡”¥íÑ¡¥Ì¹}ÍÑ…­%¹‘•àôÀ±Ñ¡¥Ì¹}±½‰…±U¹¥™½Éµ…Ñ…MÑ…¬õmt±Ñ¡¥Ì¹}Õ¹¥™½ÉµÍA½½°õmt±Ñ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÌõmt±Ñ¡¥Ì¹}‰¥¹‘É½ÕÁA½½°õmt±Ñ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÌõmt±Ñ¡¥Ì¹}É•¹‘•É•Èõ•õÉ•Í•Ð ¥íÑ¡¥Ì¹}ÍÑ…­%¹‘•àôÀí™½È¡±•Ð”ôÀí”ñÑ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÌ¹±•¹Ñ í”¬¬¥Ñ¡¥Ì¹}Õ¹¥™½ÉµÍA½½°¹ÁÕÍ ¡Ñ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÍm•t¤í™½È¡±•Ð”ôÀí”ñÑ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÌ¹±•¹Ñ í”¬¬¥Ñ¡¥Ì¹}‰¥¹‘É½ÕÁA½½°¹ÁÕÍ ¡Ñ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÍm•t¤íÑ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÌ¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÌ¹±•¹Ñ ôÁõÍÑ…ÉÐ¡”¥íÑ¡¥Ì¹É•Í•Ð ¤±Ñ¡¥Ì¹ÁÕÍ ¡”¥õ‰¥¹¡íÍ¥é”é”±ÁÉ½©•Ñ¥½¹5…ÑÉ¥àéÐ±Ý½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥àé¸±Ý½É±‘½±½ÈéÈ±½™™Í•Ðé¥ô¥í±•Ð„õÑ¡¥Ì¹}É•¹‘•É•È¹É•¹‘•ÉQ…É•Ð¹É•¹‘•ÉQ…É•Ð±ÌõÑ¡¥Ì¹}ÍÑ…­%¹‘•àýÑ¡¥Ì¹}±½‰…±U¹¥™½Éµ…Ñ…MÑ…­mÑ¡¥Ì¹}ÍÑ…­%¹‘•à´ÅtéíÁÉ½©•Ñ¥½¹…Ñ„é„±Ý½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥àé¹•Ü¼±Ý½É±‘½±½ÈèÐÈäÐäØÜÈäÔ±½™™Í•Ðé¹•Üô±°õíÁÉ½©•Ñ¥½¹5…ÑÉ¥àéÑññÑ¡¥Ì¹}É•¹‘•É•È¹É•¹‘•ÉQ…É•Ð¹ÁÉ½©•Ñ¥½¹5…ÑÉ¥à±É•Í½±ÕÑ¥½¸é•ññ„¹Í¥é”±Ý½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥àé¹ññÌ¹Ý½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥à±Ý½É±‘½±½ÈéÉññÌ¹Ý½É±‘½±½È±½™™Í•Ðé¥ññÌ¹½™™Í•Ð±‰¥¹‘É½ÕÀé¹Õ±±ô±ÔõÑ¡¥Ì¹}Õ¹¥™½ÉµÍA½½°¹Á½À ¥ññÑ¡¥Ì¹}É•…Ñ•U¹¥™½ÉµÌ ¤íÑ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÌ¹ÁÕÍ ¡Ô¤í±•ÐõÔ¹Õ¹¥™½ÉµÌí¹ÕAÉ½©•Ñ¥½¹5…ÑÉ¥àõ°¹ÁÉ½©•Ñ¥½¹5…ÑÉ¥à±¹ÕI•Í½±ÕÑ¥½¸õ°¹É•Í½±ÕÑ¥½¸±¹Õ]½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥à¹½ÁåÉ½´¡°¹Ý½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥à¤±¹Õ]½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥à¹Ñà´õ°¹½™™Í•Ð¹à±¹Õ]½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥à¹Ñä´õ°¹½™™Í•Ð¹ä±¡°¹Ý½É±‘½±½È±¹Õ]½É±‘½±½É±Á¡„°À¤±Ô¹ÕÁ‘…Ñ” ¤í±•Ð˜íÑ¡¥Ì¹}É•¹‘•É•È¹É•¹‘•ÉA¥Á•Ì¹Õ¹¥™½Éµ	…Ñ ý˜õÑ¡¥Ì¹}É•¹‘•É•È¹É•¹‘•ÉA¥Á•Ì¹Õ¹¥™½Éµ	…Ñ ¹•ÑU¹¥™½Éµ	¥¹‘É½ÕÀ¡Ô°„Ä¤è¡˜õÑ¡¥Ì¹}‰¥¹‘É½ÕÁA½½°¹Á½À ¥ññ¹•Ü•”±Ñ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÌ¹ÁÕÍ ¡˜¤±˜¹Í•ÑI•Í½ÕÉ”¡Ô°À¤¤±°¹‰¥¹‘É½ÕÀõ˜±Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„õ±õÁÕÍ ¡”¥íÑ¡¥Ì¹‰¥¹¡”¤±Ñ¡¥Ì¹}±½‰…±U¹¥™½Éµ…Ñ…MÑ…­mÑ¡¥Ì¹}ÍÑ…­%¹‘•à¬­tõÑ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ…õÁ½À ¥íÑ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„õÑ¡¥Ì¹}±½‰…±U¹¥™½Éµ…Ñ…MÑ…­l´µÑ¡¥Ì¹}ÍÑ…­%¹‘•à´Åt±Ñ¡¥Ì¹}É•¹‘•É•È¹ÑåÁ”ôôõœ¹]	0˜™Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„¹‰¥¹‘É½ÕÀ¹É•Í½ÕÉ•ÍlÁt¹ÕÁ‘…Ñ” ¥õ•Ð‰¥¹‘É½ÕÀ ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„¹‰¥¹‘É½ÕÁõ•Ð±½‰…±U¹¥™½Éµ…Ñ„ ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ…õ•ÐÕ¹¥™½ÉµÉ½ÕÀ ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„¹‰¥¹‘É½ÕÀ¹É•Í½ÕÉ•ÍlÁuõ}É•…Ñ•U¹¥™½ÉµÌ ¥íÉ•ÑÕÉ¸¹•Ü¡íÕAÉ½©•Ñ¥½¹5…ÑÉ¥àéíÙ…±Õ”é¹•Ü¼±ÑåÁ”éµ…ÐÍàÌñ˜ÌÈùô±Õ]½É±‘QÉ…¹Í™½Éµ5…ÑÉ¥àéíÙ…±Õ”é¹•Ü¼±ÑåÁ”éµ…ÐÍàÌñ˜ÌÈùô±Õ]½É±‘½±½É±Á¡„éíÙ…±Õ”é¹•Ü±½…ÐÌÉÉÉ…ä Ð¤±ÑåÁ”éÙ•ŒÐñ˜ÌÈùô±ÕI•Í½±ÕÑ¥½¸éíÙ…±Õ”élÀ°Át±ÑåÁ”éÙ•ŒÈñ˜ÌÈùõô±í¥ÍMÑ…Ñ¥Œè„Áô¥õ‘•ÍÑÉ½ä ¥íÑ¡¥Ì¹}É•¹‘•É•Èõ¹Õ±°±Ñ¡¥Ì¹}±½‰…±U¹¥™½Éµ…Ñ…MÑ…¬¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}Õ¹¥™½ÉµÍA½½°¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}…Ñ¥Ù•U¹¥™½ÉµÌ¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}‰¥¹‘É½ÕÁA½½°¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}…Ñ¥Ù•	¥¹‘É½ÕÁÌ¹±•¹Ñ ôÀ±Ñ¡¥Ì¹}ÕÉÉ•¹Ñ±½‰…±U¹¥™½Éµ…Ñ„õ¹Õ±±õôí”¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”é±½‰…±U¹¥™½ÉµÍôíÙ…È-”ôÄ±Å”õ±…ÍÍí½¹ÍÑÉÕÑ½È ¥íÑ¡¥Ì¹}Ñ…Í­Ìõmt±Ñ¡¥Ì¹}½™™Í•ÐôÁõ¥¹¥Ð ¥íÜ¹ÍåÍÑ•´¹…‘¡Ñ¡¥Ì¹}ÕÁ‘…Ñ”±Ñ¡¥Ì¥õÉ•Á•…Ð¡”±Ð±¸ô„À¥í±•ÐÈõ-”¬¬±¤ôÀíÉ•ÑÕÉ¸¸˜˜¡Ñ¡¥Ì¹}½™™Í•Ð¬ôÅ”Ì±¤õÑ¡¥Ì¹}½™™Í•Ð¤±Ñ¡¥Ì¹}Ñ…Í­Ì¹ÁÕÍ ¡í™Õ¹Œé”±‘ÕÉ…Ñ¥½¸éÐ±ÍÑ…ÉÐéÁ•É™½Éµ…¹”¹¹½Ü ¤±½™™Í•Ðé¤±±…ÍÐéÁ•É™½Éµ…¹”¹¹½Ü ¤±É•Á•…Ðè„À±¥éÉô¤±Éõ…¹•°¡”¥í™½È¡±•ÐÐôÀíÐñÑ¡¥Ì¹}Ñ…Í­Ì¹±•¹Ñ íÐ¬¬¥¥˜¡Ñ¡¥Ì¹}Ñ…Í­ÍmÑt¹¥ôôõ”¥íÑ¡¥Ì¹}Ñ…Í­Ì¹ÍÁ±¥”¡Ð°Ä¤íÉ•ÑÕÉ¹õõ}ÕÁ‘…Ñ” ¥í±•Ð”õÁ•É™½Éµ…¹”¹¹½Ü ¤í™½È¡±•ÐÐôÀíÐñÑ¡¥Ì¹}Ñ…Í­Ì¹±•¹Ñ íÐ¬¬¥í±•Ð¸õÑ¡¥Ì¹}Ñ…Í­ÍmÑtí¥˜¡”µ¸¹½™™Í•Ðµ¸¹±…ÍÐøõ¸¹‘ÕÉ…Ñ¥½¸¥í±•ÐÐõ”µ¸¹ÍÑ…ÉÐí¸¹™Õ¹Œ¡Ð¤±¸¹±…ÍÐõ•õõõ‘•ÍÑÉ½ä ¥íÜ¹ÍåÍÑ•´¹É•µ½Ù”¡Ñ¡¥Ì¹}ÕÁ‘…Ñ”±Ñ¡¥Ì¤±Ñ¡¥Ì¹}Ñ…Í­Ì¹±•¹Ñ ôÁõôíÅ”¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”éÍ¡•‘Õ±•É€±ÁÉ¥½É¥ÑäèÁôíÙ…È)”ô„Äí™Õ¹Ñ¥½¸e”¡”¥í¥˜ …)”¥í¥˜¡|¹•Ð ¤¹•Ñ9…Ù¥…Ñ½È ¤¹ÕÍ•É•¹Ð¹Ñ½1½Ý•É…Í” ¤¹¥¹‘•á=˜¡¡É½µ•€¤ø´Ä¥í±•ÐÐõm€•Œ€€•Œ€€•Œ€€•Œ€€•ŒA¥á¥)L€•ŒØ‘íUô€ ‘í•ô¤¡ÑÑÀè¼½ÝÝÜ¹Á¥á¥©Ì¹½´¼()€±‰…­É½Õ¹è€ÜÈÈØÐìÁ…‘‘¥¹œèÕÁà€Àí€±‰…­É½Õ¹è€ŒÙÉìÁ…‘‘¥¹œèÕÁà€Àí€±‰…­É½Õ¹è€ÕÌÍìÁ…‘‘¥¹œèÕÁà€Àí€±‰…­É½Õ¹è€ÈÍìÁ…‘‘¥¹œèÕÁà€Àí€±½±½Èè€ì‰…­É½Õ¹è€ÜÈÈØÐìÁ…‘‘¥¹œèÕÁà€Àí€±½±½Èè€ÜÈÈØÐì‰…­É½Õ¹è€ìÁ…‘‘¥¹œèÕÁà€Àítí±½‰…±Q¡¥Ì¹½¹Í½±”¹±½œ ¸¸¹Ð¥õ•±Í”±½‰…±Q¡¥Ì¹½¹Í½±”˜™±½‰…±Q¡¥Ì¹½¹Í½±”¹±½œ¡A¥á¥)L€‘íUô€´€‘í•ô€´¡ÑÑÀè¼½ÝÝÜ¹Á¥á¥©Ì¹½´½€¤í)”ô„ÁõõÙ…È(õ±…ÍÍí½¹ÍÑÉÕÑ½È¡”¥íÑ¡¥Ì¹}É•¹‘•É•Èõ•õ¥¹¥Ð¡”¥í¥˜¡”¹¡•±±¼¥í±•Ð”õÑ¡¥Ì¹}É•¹‘•É•È¹¹…µ”íÑ¡¥Ì¹}É•¹‘•É•È¹ÑåÁ”ôôõœ¹]	0˜˜¡”¬õ€€‘íÑ¡¥Ì¹}É•¹‘•É•È¹½¹Ñ•áÐ¹Ý•‰1Y•ÉÍ¥½¹õ€¤±e”¡”¥õõôí(¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”é¡•±±½€±ÁÉ¥½É¥Ñäè´Éô±(¹‘•™…Õ±Ñ=ÁÑ¥½¹Ìõí¡•±±¼è„ÅôíÙ…Èdõ±…ÍÌ•í½¹ÍÑÉÕÑ½È¡”¥íÑ¡¥Ì¹}É•¹‘•É•Èõ•õ¥¹¥Ð¡Ð¥íÐõì¸¸¹”¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì°¸¸¹Ñô±Ñ¡¥Ì¹µ…áU¹ÕÍ•‘Q¥µ”õÐ¹É•¹‘•É…‰±•5…áU¹ÕÍ•‘Q¥µ•õ•Ð•¹…‰±• ¥íÉ•ÑÕÉ¸´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹•¹…‰±•¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¹•¹…‰±•¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹•¹…‰±•‘õÍ•Ð•¹…‰±•¡”¥í´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹•¹…‰±•¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¹•¹…‰±•¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹•¹…‰±•õ•õ…‘‘5…¹…•‘!…Í ¡”±Ð¥í´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹…‘‘5…¹…•‘!…Í ¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¹…‘‘½±±•Ñ¥½¸¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹…‘‘½±±•Ñ¥½¸¡”±Ð±¡…Í¡€¥õ…‘‘5…¹…•‘ÉÉ…ä¡”±Ð¥í´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹…‘‘5…¹…•‘ÉÉ…ä¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¹…‘‘½±±•Ñ¥½¸¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹…‘‘½±±•Ñ¥½¸¡”±Ð±…ÉÉ…å€¥õ…‘‘I•¹‘•É…‰±”¡”¥í´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹…‘‘I•¹‘•É…‰±”¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹…‘‘I•Í½ÕÉ”¡”±É•¹‘•É…‰±•€¥õÉÕ¸ ¥í´¡€à¸ÄÔ¸Á€±I•¹‘•É…‰±•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹ÉÕ¸ ¥õ‘•ÍÑÉ½ä ¥íÑ¡¥Ì¹}É•¹‘•É•Èõ¹Õ±±õôíd¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”éÉ•¹‘•É…‰±•€±ÁÉ¥½É¥ÑäèÁô±d¹‘•™…Õ±Ñ=ÁÑ¥½¹ÌõíÉ•¹‘•É…‰±•Ñ¥Ù”è„À±É•¹‘•É…‰±•5…áU¹ÕÍ•‘Q¥µ”èÙ”Ð±É•¹‘•É…‰±•É•ÅÕ•¹äèÍ”ÑôíÙ…Èa”õd±`õ±…ÍÌ•í•Ð½Õ¹Ð ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}É•¹‘•É•È¹Ñ¥­õ•Ð¡•­½Õ¹Ð ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}¡•­½Õ¹ÑõÍ•Ð¡•­½Õ¹Ð¡”¥í´¡€à¸ÄÔ¸Á€±Q•áÑÕÉ•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}¡•­½Õ¹Ðõ•õ•Ðµ…á%‘±” ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹µ…áU¹ÕÍ•‘Q¥µ”¼Å”Ì¨ØÁõÍ•Ðµ…á%‘±”¡”¥í´¡€à¸ÄÔ¸Á€±Q•áÑÕÉ•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹µ…áU¹ÕÍ•‘Q¥µ”õ”¼ØÀ¨Å”Íõ•Ð¡•­½Õ¹Ñ5…à ¥íÉ•ÑÕÉ¸5…Ñ ¹™±½½È¡Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹}™É•ÅÕ•¹ä¼Å”Ì¥õÍ•Ð¡•­½Õ¹Ñ5…à¡”¥í´¡€à¸ÄÔ¸Á€±Q•áÑÕÉ•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¥õ•Ð…Ñ¥Ù” ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹•¹…‰±•‘õÍ•Ð…Ñ¥Ù”¡”¥í´¡€à¸ÄÔ¸Á€±Q•áÑÕÉ•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹•¹…‰±•õ•õ½¹ÍÑÉÕÑ½È¡”¥íÑ¡¥Ì¹}É•¹‘•É•Èõ”±Ñ¡¥Ì¹}¡•­½Õ¹ÐôÁõ¥¹¥Ð¡Ð¥íÐ¹Ñ•áÑÕÉ•Ñ¥Ù”„ôõ”¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì¹Ñ•áÑÕÉ•Ñ¥Ù”˜˜¡Ñ¡¥Ì¹…Ñ¥Ù”õÐ¹Ñ•áÑÕÉ•Ñ¥Ù”¤±Ð¹Ñ•áÑÕÉ•5…á%‘±”„ôõ”¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì¹Ñ•áÑÕÉ•5…á%‘±”˜˜¡Ñ¡¥Ì¹µ…á%‘±”õÐ¹Ñ•áÑÕÉ•5…á%‘±”¤±Ð¹Ñ•áÑÕÉ•¡•­½Õ¹Ñ5…à„ôõ”¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì¹Ñ•áÑÕÉ•¡•­½Õ¹Ñ5…à˜˜¡Ñ¡¥Ì¹¡•­½Õ¹Ñ5…àõÐ¹Ñ•áÑÕÉ•¡•­½Õ¹Ñ5…à¥õÉÕ¸ ¥í´¡€à¸ÄÔ¸Á€±Q•áÑÕÉ•MåÍÑ•´¹ÉÕ¸¥Ì‘•ÁÉ•…Ñ•°Á±•…Í”ÕÍ”Ñ¡”MåÍÑ•´¥¹ÍÑ•…¹€¤±Ñ¡¥Ì¹}É•¹‘•É•È¹Œ¹ÉÕ¸ ¥õ‘•ÍÑÉ½ä ¥íÑ¡¥Ì¹}É•¹‘•É•Èõ¹Õ±±õôí`¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•µt±¹…µ”éÑ•áÑÕÉ•ô±`¹‘•™…Õ±Ñ=ÁÑ¥½¹ÌõíÑ•áÑÕÉ•Ñ¥Ù”è„À±Ñ•áÑÕÉ•5…á%‘±”é¹Õ±°±Ñ•áÑÕÉ•5…á%‘±”èÌØÀÀ±Ñ•áÑÕÉ•¡•­½Õ¹Ñ5…àèØÀÁôíÙ…Èi”õ`±E”õ±…ÍÌ•í½¹ÍÑÉÕÑ½È¡Ðõíô¥í¥˜¡Ñ¡¥Ì¹Õ¥õ„¡É•¹‘•ÉQ…É•Ñ€¤±Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ•Ìõmt±Ñ¡¥Ì¹‘¥ÉÑå%ôÀ±Ñ¡¥Ì¹¥ÍI½½Ðô„Ä±Ñ¡¥Ì¹}Í¥é”õ¹•Ü±½…ÐÌÉÉÉ…ä È¤±Ñ¡¥Ì¹}µ…¹…•‘½±½ÉQ•áÑÕÉ•Ìô„Ä±Ðõì¸¸¹”¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì°¸¸¹Ñô±Ñ¡¥Ì¹ÍÑ•¹¥°õÐ¹ÍÑ•¹¥°±Ñ¡¥Ì¹‘•ÁÑ õÐ¹‘•ÁÑ ±Ñ¡¥Ì¹¥ÍI½½ÐõÐ¹¥ÍI½½Ð±ÑåÁ•½˜Ð¹½±½ÉQ•áÑÕÉ•Ìôõ¹Õµ‰•É€¥íÑ¡¥Ì¹}µ…¹…•‘½±½ÉQ•áÑÕÉ•Ìô„Àí™½È¡±•Ð”ôÀí”ñÐ¹½±½ÉQ•áÑÕÉ•Ìí”¬¬¥Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ•Ì¹ÁÕÍ ¡¹•ÜØ¡íÝ¥‘Ñ éÐ¹Ý¥‘Ñ ±¡•¥¡ÐéÐ¹¡•¥¡Ð±É•Í½±ÕÑ¥½¸éÐ¹É•Í½±ÕÑ¥½¸±…¹Ñ¥…±¥…ÌéÐ¹…¹Ñ¥…±¥…Íô¤¥õ•±Í•íÑ¡¥Ì¹½±½ÉQ•áÑÕÉ•Ìõl¸¸¹Ð¹½±½ÉQ•áÑÕÉ•Ì¹µ…À¡”ôù”¹Í½ÕÉ”¥tí±•Ð”õÑ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”íÑ¡¥Ì¹É•Í¥é”¡”¹Ý¥‘Ñ ±”¹¡•¥¡Ð±”¹}É•Í½±ÕÑ¥½¸¥õÑ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹½¸¡É•Í¥é•€±Ñ¡¥Ì¹½¹M½ÕÉ•I•Í¥é”±Ñ¡¥Ì¤°¡Ð¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ•ññÑ¡¥Ì¹ÍÑ•¹¥°¤˜˜¡Ð¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¥¹ÍÑ…¹•½˜¡ññÐ¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¥¹ÍÑ…¹•½˜ØýÑ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”õÐ¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¹Í½ÕÉ”éÑ¡¥Ì¹•¹ÍÕÉ••ÁÑ¡MÑ•¹¥±Q•áÑÕÉ” ¤¥õ•ÐÍ¥é” ¥í±•Ð”õÑ¡¥Ì¹}Í¥é”íÉ•ÑÕÉ¸•lÁtõÑ¡¥Ì¹Á¥á•±]¥‘Ñ ±•lÅtõÑ¡¥Ì¹Á¥á•±!•¥¡Ð±•õ•ÐÝ¥‘Ñ  ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹Ý¥‘Ñ¡õ•Ð¡•¥¡Ð ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹¡•¥¡Ñõ•ÐÁ¥á•±]¥‘Ñ  ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹Á¥á•±]¥‘Ñ¡õ•ÐÁ¥á•±!•¥¡Ð ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹Á¥á•±!•¥¡Ñõ•ÐÉ•Í½±ÕÑ¥½¸ ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹}É•Í½±ÕÑ¥½¹õ•Ð½±½ÉQ•áÑÕÉ” ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ•ÍlÁuõ½¹M½ÕÉ•I•Í¥é”¡”¥íÑ¡¥Ì¹É•Í¥é”¡”¹Ý¥‘Ñ ±”¹¡•¥¡Ð±”¹}É•Í½±ÕÑ¥½¸°„À¥õ•¹ÍÕÉ••ÁÑ¡MÑ•¹¥±Q•áÑÕÉ” ¥íÑ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ•ñðõ¹•ÜØ¡íÝ¥‘Ñ éÑ¡¥Ì¹Ý¥‘Ñ ±¡•¥¡ÐéÑ¡¥Ì¹¡•¥¡Ð±É•Í½±ÕÑ¥½¸éÑ¡¥Ì¹É•Í½±ÕÑ¥½¸±™½Éµ…Ðé‘•ÁÑ ÈÑÁ±ÕÌµÍÑ•¹¥°á€±…ÕÑ½•¹•É…Ñ•5¥Áµ…ÁÌè„Ä±…¹Ñ¥…±¥…Ìè„Ä±µ¥Á1•Ù•±½Õ¹ÐèÅô¥õÉ•Í¥é”¡”±Ð±¸õÑ¡¥Ì¹É•Í½±ÕÑ¥½¸±Èô„Ä¥íÑ¡¥Ì¹‘¥ÉÑå%¬¬±Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ•Ì¹™½É…  ¡¤±„¤ôùíÈ˜™„ôôôÁññ¤¹Í½ÕÉ”¹É•Í¥é”¡”±Ð±¸¥ô¤±Ñ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”˜™Ñ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¹Í½ÕÉ”¹É•Í¥é”¡”±Ð±¸¥õ‘•ÍÑÉ½ä ¥íÑ¡¥Ì¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹½™˜¡É•Í¥é•€±Ñ¡¥Ì¹½¹M½ÕÉ•I•Í¥é”±Ñ¡¥Ì¤±Ñ¡¥Ì¹}µ…¹…•‘½±½ÉQ•áÑÕÉ•Ì˜™Ñ¡¥Ì¹½±½ÉQ•áÑÕÉ•Ì¹™½É… ¡”ôùí”¹‘•ÍÑÉ½ä ¥ô¤±Ñ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”˜˜¡Ñ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¹‘•ÍÑÉ½ä ¤±‘•±•Ñ”Ñ¡¥Ì¹‘•ÁÑ¡MÑ•¹¥±Q•áÑÕÉ”¥õôíE”¹‘•™…Õ±Ñ=ÁÑ¥½¹ÌõíÝ¥‘Ñ èÀ±¡•¥¡ÐèÀ±É•Í½±ÕÑ¥½¸èÄ±½±½ÉQ•áÑÕÉ•ÌèÄ±ÍÑ•¹¥°è„Ä±‘•ÁÑ è„Ä±…¹Ñ¥…±¥…Ìè„Ä±¥ÍI½½Ðè„ÅôíÙ…ÈhõE”±Dõ¹•Ü5…Àí¸¹É•¥ÍÑ•È¡D¤í™Õ¹Ñ¥½¸€‘”¡”±Ð¥í¥˜ …D¹¡…Ì¡”¤¥í±•Ð¸õ¹•Ü ¡íÍ½ÕÉ”é¹•Ü¡íÉ•Í½ÕÉ”é”°¸¸¹Ñô¥ô¤±Èô ¤ôùíD¹•Ð¡”¤ôôõ¸˜™D¹‘•±•Ñ”¡”¥ôí¸¹½¹”¡‘•ÍÑÉ½å€±È¤±¸¹Í½ÕÉ”¹½¹”¡‘•ÍÑÉ½å€±È¤±D¹Í•Ð¡”±¸¥õÉ•ÑÕÉ¸D¹•Ð¡”¥õÙ…È€õ±…ÍÌÑí•Ð…ÕÑ½•¹Í¥Ñä ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹…ÕÑ½•¹Í¥ÑåõÍ•Ð…ÕÑ½•¹Í¥Ñä¡”¥íÑ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹…ÕÑ½•¹Í¥Ñäõ•õ•ÐÉ•Í½±ÕÑ¥½¸ ¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹}É•Í½±ÕÑ¥½¹õÍ•ÐÉ•Í½±ÕÑ¥½¸¡”¥íÑ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹É•Í¥é”¡Ñ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹Ý¥‘Ñ ±Ñ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹¡•¥¡Ð±”¥õ¥¹¥Ð¡¸¥í¸õì¸¸¹Ð¹‘•™…Õ±Ñ=ÁÑ¥½¹Ì°¸¸¹¹ô±¸¹Ù¥•Ü˜˜¡´¡”±Y¥•ÝMåÍÑ•´¹Ù¥•Ü¡…Ì‰••¸É•¹…µ•Ñ¼Y¥•ÝMåÍÑ•´¹…¹Ù…Í€¤±¸¹…¹Ù…Ìõ¸¹Ù¥•Ü¤±Ñ¡¥Ì¹ÍÉ••¸õ¹•ÜÔ À°À±¸¹Ý¥‘Ñ ±¸¹¡•¥¡Ð¤±Ñ¡¥Ì¹…¹Ù…Ìõ¸¹…¹Ù…Íññ|¹•Ð ¤¹É•…Ñ•…¹Ù…Ì ¤±Ñ¡¥Ì¹…¹Ñ¥…±¥…Ìô„…¸¹…¹Ñ¥…±¥…Ì±Ñ¡¥Ì¹Ñ•áÑÕÉ”ô‘”¡Ñ¡¥Ì¹…¹Ù…Ì±¸¤±Ñ¡¥Ì¹É•¹‘•ÉQ…É•Ðõ¹•Üh¡í½±½ÉQ•áÑÕÉ•ÌémÑ¡¥Ì¹Ñ•áÑÕÉ•t±‘•ÁÑ è„…¸¹‘•ÁÑ ±¥ÍI½½Ðè„Áô¤±Ñ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹ÑÉ…¹ÍÁ…É•¹Ðõ¸¹‰…­É½Õ¹‘±Á¡„ðÄ±Ñ¡¥Ì¹É•Í½±ÕÑ¥½¸õ¸¹É•Í½±ÕÑ¥½¹õÉ•Í¥é”¡”±Ð±¸¥íÑ¡¥Ì¹Ñ•áÑÕÉ”¹Í½ÕÉ”¹É•Í¥é”¡”±Ð±¸¤±Ñ¡¥Ì¹ÍÉ••¸¹Ý¥‘Ñ õÑ¡¥Ì¹Ñ•áÑÕÉ”¹™É…µ”¹Ý¥‘Ñ ±Ñ¡¥Ì¹ÍÉ••¸¹¡•¥¡ÐõÑ¡¥Ì¹Ñ•áÑÕÉ”¹™É…µ”¹¡•¥¡Ñõ‘•ÍÑÉ½ä¡”ô„Ä¥ì¡ÑåÁ•½˜”ôõ‰½½±•…¹€ý”é”ü¹É•µ½Ù•Y¥•Ü¤˜™Ñ¡¥Ì¹…¹Ù…Ì¹Á…É•¹Ñ9½‘”˜™Ñ¡¥Ì¹…¹Ù…Ì¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥±¡Ñ¡¥Ì¹…¹Ù…Ì¤±Ñ¡¥Ì¹Ñ•áÑÕÉ”¹‘•ÍÑÉ½ä ¥õôì¹•áÑ•¹Í¥½¸õíÑåÁ”émˆ¹]•‰1MåÍÑ•´±ˆ¹]•‰AUMåÍÑ•´±ˆ¹…¹Ù…ÍMåÍÑ•µt±¹…µ”éÙ¥•Ý€±ÁÉ¥½É¥ÑäèÁô°¹‘•™…Õ±Ñ=ÁÑ¥½¹ÌõíÝ¥‘Ñ èàÀÀ±¡•¥¡ÐèØÀÀ±…ÕÑ½•¹Í¥Ñäè„Ä±…¹Ñ¥…±¥…Ìè„ÅôíÙ…È•Ðõm”±”±(°±”±]”±i”±Y”±%”±5”±a”±Å•t±ÑÐõm0±8±¨±±@±A”±9”±tí™Õ¹Ñ¥½¸¹Ð¡”±Ð±¸±È±¤±„¥í±•Ð¼õ„üÄè´ÄíÉ•ÑÕÉ¸”¹¥‘•¹Ñ¥Ñä ¤±”¹„ôÄ½È¨È±”¹õ¼¨ Ä½¤¨È¤±”¹Ñàô´ÄµÐ©”¹„±”¹Ñäôµ¼µ¸©”¹±•õ™Õ¹Ñ¥½¸ÉÐ¡”¥í±•ÐÐõ”¹½±½ÉQ•áÑÕÉ”¹Í½ÕÉ”¹É•Í½ÕÉ”íÉ•ÑÕÉ¸±½‰…±Q¡¥Ì¹!Q51…¹Ù…Í±•µ•¹Ð˜™Ð¥¹ÍÑ…¹•½˜!Q51…¹Ù…Í±•µ•¹Ð˜™‘½Õµ•¹Ð¹‰½‘ä¹½¹Ñ…¥¹Ì¡Ð¥õÙ…È¥Ðõ±…ÍÍí½¹ÍÑÉÕÑ½È¡”¥íÑ¡¥Ì¹É½½ÑY¥•ÝA½ÉÐõ¹•ÜÔ±Ñ¡¥Ì¹Ù¥•ÝÁ½ÉÐõ¹•ÜÔ±Ñ¡¥Ì¹µ¥Á1•Ù•°ôÀ±Ñ¡¥Ì¹±…å•ÈôÀ±Ñ¡¥Ì¹½¹I•¹‘•ÉQ…É•Ñ¡…¹”õ¹•ÜÙ”¡½¹I•¹‘•ÉQ…É•Ñ¡…¹•€¤±Ñ¡¥Ì¹ÁÉ½©•Ñ¥½¹5…ÑÉ¥àõ¹•Ü¼±Ñ¡¥Ì¹‘•™…Õ±Ñ±•…É½±½ÈõlÀ°À°À°Át±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í õ¹•Ü5…À±Ñ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í õ=‰©•Ð¹É•…Ñ”¡¹Õ±°¤±Ñ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…¬õmt±Ñ¡¥Ì¹}É•¹‘•É•Èõ”±”¹Œ¹…‘‘½±±•Ñ¥½¸¡Ñ¡¥Ì±}ÁÕI•¹‘•ÉQ…É•Ñ!…Í¡€±¡…Í¡€¥õ™¥¹¥Í¡I•¹‘•ÉA…ÍÌ ¥íÑ¡¥Ì¹…‘…ÁÑ½È¹™¥¹¥Í¡I•¹‘•ÉA…ÍÌ¡Ñ¡¥Ì¹É•¹‘•ÉQ…É•Ð¥õÉ•¹‘•ÉMÑ…ÉÐ¡íÑ…É•Ðé”±±•…ÈéÐ±±•…É½±½Èé¸±™É…µ”éÈ±µ¥Á1•Ù•°é¤±±…å•Èé…ô¥íÑ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…¬¹±•¹Ñ ôÀ±Ñ¡¥Ì¹ÁÕÍ ¡”±Ð±¸±È±¤üüÀ±„üüÀ¤±Ñ¡¥Ì¹É½½ÑY¥•ÝA½ÉÐ¹½ÁåÉ½´¡Ñ¡¥Ì¹Ù¥•ÝÁ½ÉÐ¤±Ñ¡¥Ì¹É½½ÑI•¹‘•ÉQ…É•ÐõÑ¡¥Ì¹É•¹‘•ÉQ…É•Ð±Ñ¡¥Ì¹É•¹‘•É¥¹Q½MÉ••¸õÉÐ¡Ñ¡¥Ì¹É½½ÑI•¹‘•ÉQ…É•Ð¤±Ñ¡¥Ì¹…‘…ÁÑ½È¹ÁÉ•É•¹‘•Èü¸¡Ñ¡¥Ì¹É½½ÑI•¹‘•ÉQ…É•Ð¥õÁ½ÍÑÉ•¹‘•È ¥íÑ¡¥Ì¹…‘…ÁÑ½È¹Á½ÍÑÉ•¹‘•Èü¸¡Ñ¡¥Ì¹É½½ÑI•¹‘•ÉQ…É•Ð¥õ‰¥¹¡”±Ðô„À±¸±È±¤ôÀ±„ôÀ¥í±•Ð¼õÑ¡¥Ì¹•ÑI•¹‘•ÉQ…É•Ð¡”¤±ÌõÑ¡¥Ì¹É•¹‘•ÉQ…É•Ð„ôõ¼íÑ¡¥Ì¹É•¹‘•ÉQ…É•Ðõ¼±Ñ¡¥Ì¹É•¹‘•ÉMÕÉ™…”õ”í±•ÐŒõÑ¡¥Ì¹•ÑÁÕI•¹‘•ÉQ…É•Ð¡¼¤ì¡¼¹Á¥á•±]¥‘Ñ „ôõŒ¹Ý¥‘Ñ¡ññ¼¹Á¥á•±!•¥¡Ð„ôõŒ¹¡•¥¡Ð¤˜˜¡Ñ¡¥Ì¹…‘…ÁÑ½È¹É•Í¥é•ÁÕI•¹‘•ÉQ…É•Ð¡¼¤±Œ¹Ý¥‘Ñ õ¼¹Á¥á•±]¥‘Ñ ±Œ¹¡•¥¡Ðõ¼¹Á¥á•±!•¥¡Ð¤í±•Ð°õ¼¹½±½ÉQ•áÑÕÉ”±ÔõÑ¡¥Ì¹Ù¥•ÝÁ½ÉÐ±õ°¹…ÉÉ…å1…å•É½Õ¹ÑñðÄí¥˜ ¡…ðÀ¤„ôõ„˜˜¡…ðôÀ¤±„ðÁññ„øõ¥Ñ¡É½ÜÉÉ½È¡mI•¹‘•ÉQ…É•ÑMåÍÑ•µt±…å•È€‘í…ô¥Ì½ÕÐ½˜‰½Õ¹‘Ì€¡…ÉÉ…å1…å•É½Õ¹Ðô‘í‘ô¤¹€¤íÑ¡¥Ì¹µ¥Á1•Ù•°õ¥ðÀ±Ñ¡¥Ì¹±…å•Èõ…ðÀí±•Ð˜õ5…Ñ ¹µ…à¡°¹Á¥á•±]¥‘Ñ øù¤°Ä¤±Àõ5…Ñ ¹µ…à¡°¹Á¥á•±!•¥¡Ðøù¤°Ä¤í¥˜ …È˜™”¥¹ÍÑ…¹•½˜ ˜˜¡Èõ”¹™É…µ”¤±È¥í±•Ð”õ°¹}É•Í½±ÕÑ¥½¸±ÐôÄðñ5…Ñ ¹µ…à¡¥ðÀ°À¤±¸õÈ¹à©”¬¸ÕðÀ±„õÈ¹ä©”¬¸ÕðÀ±¼õÈ¹Ý¥‘Ñ ©”¬¸ÕðÀ±ÌõÈ¹¡•¥¡Ð©”¬¸ÕðÀ±Œõ5…Ñ ¹™±½½È¡¸½Ð¤±õ5…Ñ ¹™±½½È¡„½Ð¤±´õ5…Ñ ¹•¥°¡¼½Ð¤± õ5…Ñ ¹•¥°¡Ì½Ð¤íŒõ5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à¡Œ°À¤±˜´Ä¤±õ5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à¡°À¤±À´Ä¤±´õ5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à¡´°Ä¤±˜µŒ¤± õ5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à¡ °Ä¤±Àµ¤±Ô¹àõŒ±Ô¹äõ±Ô¹Ý¥‘Ñ õ´±Ô¹¡•¥¡Ðõ¡õ•±Í”Ô¹àôÀ±Ô¹äôÀ±Ô¹Ý¥‘Ñ õ˜±Ô¹¡•¥¡ÐõÀíÉ•ÑÕÉ¸¹Ð¡Ñ¡¥Ì¹ÁÉ½©•Ñ¥½¹5…ÑÉ¥à°À°À±Ô¹Ý¥‘Ñ ½°¹É•Í½±ÕÑ¥½¸±Ô¹¡•¥¡Ð½°¹É•Í½±ÕÑ¥½¸°…¼¹¥ÍI½½Ð¤±Ñ¡¥Ì¹…‘…ÁÑ½È¹ÍÑ…ÉÑI•¹‘•ÉA…ÍÌ¡¼±Ð±¸±Ô±¤±„¤±Ì˜™Ñ¡¥Ì¹½¹I•¹‘•ÉQ…É•Ñ¡…¹”¹•µ¥Ð¡¼¤±½õ±•…È¡”±ÐõX¹10±¸±ÈõÑ¡¥Ì¹µ¥Á1•Ù•°±¤õÑ¡¥Ì¹±…å•È¥íÐ˜˜¡”˜˜õÑ¡¥Ì¹•ÑI•¹‘•ÉQ…É•Ð¡”¤±Ñ¡¥Ì¹…‘…ÁÑ½È¹±•…È¡•ññÑ¡¥Ì¹É•¹‘•ÉQ…É•Ð±Ð±¸±Ñ¡¥Ì¹Ù¥•ÝÁ½ÉÐ±È±¤¤¥õ½¹Ñ•áÑ¡…¹” ¥íÑ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í õ=‰©•Ð¹É•…Ñ”¡¹Õ±°¥õÁÕÍ ¡”±ÐõX¹10±¸±È±¤ôÀ±„ôÀ¥í±•Ð¼õÑ¡¥Ì¹‰¥¹¡”±Ð±¸±È±¤±„¤íÉ•ÑÕÉ¸Ñ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…¬¹ÁÕÍ ¡íÉ•¹‘•ÉQ…É•Ðé¼±™É…µ”éÈ±µ¥Á1•Ù•°é¤±±…å•Èé…ô¤±½õÁ½À ¥íÑ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…¬¹Á½À ¤í±•Ð”õÑ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…­mÑ¡¥Ì¹}É•¹‘•ÉQ…É•ÑMÑ…¬¹±•¹Ñ ´ÅtíÑ¡¥Ì¹‰¥¹¡”¹É•¹‘•ÉQ…É•Ð°„Ä±¹Õ±°±”¹™É…µ”±”¹µ¥Á1•Ù•°±”¹±…å•È¥õ•ÑI•¹‘•ÉQ…É•Ð¡”¥íÉ•ÑÕÉ¸”¹¥ÍQ•áÑÕÉ”˜˜¡”õ”¹Í½ÕÉ”¤±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í ¹•Ð¡”¤üýÑ¡¥Ì¹}¥¹¥ÑI•¹‘•ÉQ…É•Ð¡”¥õ½ÁåQ½Q•áÑÕÉ”¡”±Ð±¸±È±¤¥í¸¹àðÀ˜˜¡È¹Ý¥‘Ñ ¬õ¸¹à±¤¹à´õ¸¹à±¸¹àôÀ¤±¸¹äðÀ˜˜¡È¹¡•¥¡Ð¬õ¸¹ä±¤¹ä´õ¸¹ä±¸¹äôÀ¤í±•ÑíÁ¥á•±]¥‘Ñ é„±Á¥á•±!•¥¡Ðé½ôõ”íÉ•ÑÕÉ¸È¹Ý¥‘Ñ õ5…Ñ ¹µ¥¸¡È¹Ý¥‘Ñ ±„µ¸¹à¤±È¹¡•¥¡Ðõ5…Ñ ¹µ¥¸¡È¹¡•¥¡Ð±¼µ¸¹ä¤±Ñ¡¥Ì¹…‘…ÁÑ½È¹½ÁåQ½Q•áÑÕÉ”¡”±Ð±¸±È±¤¥õ•¹ÍÕÉ••ÁÑ¡MÑ•¹¥° ¥íÑ¡¥Ì¹É•¹‘•ÉQ…É•Ð¹ÍÑ•¹¥±ñð¡Ñ¡¥Ì¹É•¹‘•ÉQ…É•Ð¹ÍÑ•¹¥°ô„À±Ñ¡¥Ì¹…‘…ÁÑ½È¹ÍÑ…ÉÑI•¹‘•ÉA…ÍÌ¡Ñ¡¥Ì¹É•¹‘•ÉQ…É•Ð°„Ä±¹Õ±°±Ñ¡¥Ì¹Ù¥•ÝÁ½ÉÐ°À±Ñ¡¥Ì¹±…å•È¤¥õ‘•ÍÑÉ½ä ¥íÑ¡¥Ì¹}É•¹‘•É•Èõ¹Õ±°±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í ¹™½É…  ¡”±Ð¤ôùí”„ôõÐ˜™”¹‘•ÍÑÉ½ä ¥ô¤±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í ¹±•…È ¤±Ñ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í õ=‰©•Ð¹É•…Ñ”¡¹Õ±°¥õ}¥¹¥ÑI•¹‘•ÉQ…É•Ð¡”¥í±•ÐÐõ¹Õ±°íÉ•ÑÕÉ¸¹Ñ•ÍÐ¡”¤˜˜¡”ô‘”¡”¤¹Í½ÕÉ”¤±”¥¹ÍÑ…¹•½˜hýÐõ”é”¥¹ÍÑ…¹•½˜Ø˜˜¡Ðõ¹•Üh¡í½±½ÉQ•áÑÕÉ•Ìém•uô¤±”¹Í½ÕÉ”¥¹ÍÑ…¹•½˜˜˜¡Ð¹¥ÍI½½Ðô„À¤±”¹½¹”¡‘•ÍÑÉ½å€° ¤ôùíÐ¹‘•ÍÑÉ½ä ¤±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í ¹‘•±•Ñ”¡”¤í±•Ð¸õÑ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í¡mÐ¹Õ¥‘tí¸˜˜¡Ñ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í¡mÐ¹Õ¥‘tõ¹Õ±°±Ñ¡¥Ì¹…‘…ÁÑ½È¹‘•ÍÑÉ½åÁÕI•¹‘•ÉQ…É•Ð¡¸¤¥ô¤¤±Ñ¡¥Ì¹}É•¹‘•ÉMÕÉ™…•Q½I•¹‘•ÉQ…É•Ñ!…Í ¹Í•Ð¡”±Ð¤±Ñõ•ÑÁÕI•¹‘•ÉQ…É•Ð¡”¥íÉ•ÑÕÉ¸Ñ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í¡m”¹Õ¥‘uñð¡Ñ¡¥Ì¹}ÁÕI•¹‘•ÉQ…É•Ñ!…Í¡m”¹Õ¥‘tõÑ¡¥Ì¹…‘…ÁÑ½È¹¥¹¥ÑÁÕI•¹‘•ÉQ…É•Ð¡”¤¥õÉ•Í•ÑMÑ…Ñ” ¥íÑ¡¥Ì¹É•¹‘•ÉQ…É•Ðõ¹Õ±°±Ñ¡¥Ì¹É•¹‘•ÉMÕÉ™…”õ¹Õ±±õôí•áÁ½ÉÑíá”…Ì„±0…ÌŒ±8…Ì±¨…Ì˜±…Ì ±©”…Ì¤±…Ì°±<…Ì´±ÑÐ…Ì¸±X…Ì¼±…ÌÀ±•Ð…ÌÈ±…ÌÌ±¥Ð…ÌÐ±@…ÌÕôì