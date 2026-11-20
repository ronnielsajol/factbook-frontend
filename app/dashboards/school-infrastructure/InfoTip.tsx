'use client';
import {useEffect,useId,useRef,useState} from 'react';
export default function InfoTip({label,children}:{label:string;children:React.ReactNode}){
 const id=useId();const root=useRef<HTMLSpanElement>(null);const [open,setOpen]=useState(false);const [pinned,setPinned]=useState(false);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setOpen(false);setPinned(false);}};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setPinned(false);}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 return <span ref={root} className="school-info-tip" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>{if(!pinned&&!root.current?.contains(document.activeElement))setOpen(false);}} onBlur={e=>{if(!pinned&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><button type="button" aria-label={label} aria-expanded={open} aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onClick={()=>{setPinned(!pinned);setOpen(!pinned);}}>i</button>{open&&<span id={id} role="tooltip" className="school-info-explanation">{children}</span>}</span>;
}
