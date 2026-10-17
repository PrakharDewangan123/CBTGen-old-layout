import { useEffect, useRef, useState } from 'react'
import { cropPdfRegion, previewPdfPage } from '../services/documentProcessingApi'

export default function PdfVisualCropReview({ file, pageNumber, role, label, onApproved, initialCandidate = null, disabled = false }) {
  const imageRef = useRef(null)
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [start, setStart] = useState(null), [selection, setSelection] = useState(null), [crop, setCrop] = useState(null), [reviewed, setReviewed] = useState(false)
  const validPdf = Boolean(file && Number.isInteger(pageNumber) && pageNumber >= 1 && /\.pdf$/i.test(file.name || ''))
  const loading = validPdf && !preview && !error

  useEffect(() => {
    let active = true; const controller = new AbortController()
    if (!validPdf) { return () => controller.abort() }
    previewPdfPage(file, { pageNumber, signal: controller.signal }).then(v => { if (active) setPreview(v) }).catch(e => { if (active && e?.name !== 'AbortError') setError(e?.message || 'Could not preview page.') })
    return () => { active = false; controller.abort() }
  }, [file, pageNumber, validPdf])

  useEffect(() => {
    if (!preview || !initialCandidate?.imageDataUrl ||
        !initialCandidate?.assetId || !initialCandidate?.bounds) return

    const bounds = initialCandidate.bounds
    if (!['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) ||
        bounds.x < 0 || bounds.y < 0 || bounds.width <= 0 || bounds.height <= 0 ||
        bounds.x + bounds.width > preview.pageWidthPoints ||
        bounds.y + bounds.height > preview.pageHeightPoints) {
      return
    }

    const im = imageRef.current
    if (!im) return
    const rect = im.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    setSelection({
      x: bounds.x * rect.width / preview.pageWidthPoints,
      y: bounds.y * rect.height / preview.pageHeightPoints,
      width: bounds.width * rect.width / preview.pageWidthPoints,
      height: bounds.height * rect.height / preview.pageHeightPoints,
    })
    setCrop({
      assetId: initialCandidate.assetId,
      imageDataUrl: initialCandidate.imageDataUrl,
      bounds,
    })
    setReviewed(false)
    setError('')
  }, [preview, initialCandidate?.assetId, initialCandidate?.imageDataUrl, initialCandidate?.bounds])

  const candidateBounds = initialCandidate?.bounds
  const invalidCandidateBounds = Boolean(
    preview && initialCandidate?.imageDataUrl && initialCandidate?.assetId && candidateBounds &&
    (!['x', 'y', 'width', 'height'].every((key) => Number.isFinite(candidateBounds[key])) ||
      candidateBounds.x < 0 || candidateBounds.y < 0 ||
      candidateBounds.width <= 0 || candidateBounds.height <= 0 ||
      candidateBounds.x + candidateBounds.width > preview.pageWidthPoints ||
      candidateBounds.y + candidateBounds.height > preview.pageHeightPoints)
  )

  function point(e) { const im=imageRef.current; if (!im || !preview) return null; const r=im.getBoundingClientRect(); return {x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top)),w:r.width,h:r.height} }
  function down(e) { if(disabled||loading||busy||!preview)return; const p=point(e); if(!p||!p.w||!p.h)return; e.currentTarget.setPointerCapture?.(e.pointerId); setStart({x:p.x,y:p.y}); setSelection({x:p.x,y:p.y,width:0,height:0}); setCrop(null);setReviewed(false);setError('') }
  function move(e) { if(!start)return; const p=point(e);if(!p)return;setSelection({x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),width:Math.abs(p.x-start.x),height:Math.abs(p.y-start.y)}) }
  function up() { setStart(null); if(selection&&(selection.width<8||selection.height<8)){setSelection(null);setError('Select a larger rectangle.')} }
  async function makeCrop() {
    if(!preview||!selection||selection.width<8||selection.height<8){setError('Drag a rectangle around the content first.');return}
    const im=imageRef.current;if(!im)return;const r=im.getBoundingClientRect()
    const bounds={x:selection.x*preview.pageWidthPoints/r.width,y:selection.y*preview.pageHeightPoints/r.height,width:selection.width*preview.pageWidthPoints/r.width,height:selection.height*preview.pageHeightPoints/r.height}
    setBusy(true);setError('');setCrop(null);setReviewed(false)
    try {const result=await cropPdfRegion(file,{sourceSha256:preview.sourceSha256,pageNumber,regionBounds:bounds,contentBounds:bounds,role,paddingPoints:0,dpi:180});setCrop({...result,bounds})} catch(e){setError(e?.message||'Crop failed.')} finally{setBusy(false)}
  }
  return <section className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3" aria-label={`${label} visual crop`}>
    <h5 className="text-sm font-semibold">Visual crop: {label}</h5><p className="mt-1 text-xs">Drag tightly around the content. Keep printed question numbers and option labels outside the rectangle.</p>
    {loading&&<p role="status">Loading PDF page…</p>}{(error || invalidCandidateBounds) && <p role="alert" className="text-xs text-red-700">{error || "The proposed crop bounds are invalid. Select the crop manually."}</p>}
    {preview&&<div className="mt-3 grid gap-3 lg:grid-cols-2"><div>
      <div className="relative inline-block max-w-full select-none overflow-hidden border bg-white"><img ref={imageRef} src={preview.imageDataUrl} alt={`Original PDF page ${pageNumber} for crop selection`} draggable="false" className="block h-auto max-h-[70vh] max-w-full touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{cursor:disabled?'default':'crosshair'}}/>
      {selection&&<div aria-label="Selected crop rectangle" className="pointer-events-none absolute border-2 border-blue-600 bg-blue-300/20" style={{left:selection.x,top:selection.y,width:selection.width,height:selection.height}}/>}</div>
      <div className="mt-2 flex gap-2"><button type="button" disabled={disabled||busy||!selection} onClick={()=>{setSelection(null);setCrop(null);setReviewed(false)}}>Reset selection</button><button type="button" disabled={disabled||busy||!selection} onClick={makeCrop}>{busy?'Creating…':'Create crop preview'}</button></div></div>
      <div><p className="text-xs font-semibold">Crop review</p>{crop?<div className="rounded border bg-white p-2">{initialCandidate?.assetId === crop.assetId && <p className="mb-2 text-xs font-semibold text-amber-800">Automatically generated candidate — inspect and adjust before approval.</p>}<img src={crop.imageDataUrl} alt={`${label} crop preview`} className="mx-auto max-h-64 max-w-full object-contain"/><label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I verified the crop and confirmed printed labels are excluded.</label><button type="button" disabled={!reviewed||disabled||busy} onClick={()=>onApproved?.({assetId:crop.assetId,imageDataUrl:crop.imageDataUrl,mimeType:'image/png',role,pageNumber,sourceSha256:preview.sourceSha256,bounds:crop.bounds,reviewStatus:'human-reviewed',labelExclusionConfirmed:true})}>Use this image</button></div>:<p className="rounded border border-dashed p-4 text-xs">Create a crop preview to inspect it.</p>}</div>
    </div>}{(!file||!/\.pdf$/i.test(file?.name||''))&&<p className="text-xs text-amber-800">Visual cropping currently supports PDF sources only; DOCX crop geometry is unsupported.</p>}
  </section>
}
