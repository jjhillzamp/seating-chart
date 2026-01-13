"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";


type TableType = "rect" | "square" | "circle" | "desk";


type Table = {
 id: string;
 name: string;
 type: TableType;
 x: number;
 y: number;
 w: number;
 h: number;
 seats: number;
 rotation: number;
};


type Student = {
 id: string;
 name: string;
};


type Assignments = Record<string, string>;




/**
* Elementary Seating Chart Builder (Free Prototype)
* - Drag/drop tables + desks onto a snap-to-grid room
* - Drag student names onto seat dots
* - Print-friendly view (hides UI)
* - Local save/load via localStorage
*/


const GRID = 20;
const STORAGE_KEY = "seat-chart-prototype-v1";


const uid = () => Math.random().toString(36).slice(2, 10);


function snap(n: number) {
 return Math.round(n / GRID) * GRID;
}


function clamp(n: number, min: number, max: number) {
 return Math.max(min, Math.min(max, n));
}


function defaultSeatsFor(type: "rect" | "square" | "circle" | "desk") {
 switch (type) {
   case "rect":
     return 6;
   case "square":
     return 4;
   case "circle":
     return 4;
   case "desk":
     return 1;
   default:
     return 4;
 }
}


function defaultSizeFor(type: "rect" | "square" | "circle" | "desk") {
 switch (type) {
   case "rect":
     return { w: 160, h: 90 };
   case "square":
     return { w: 120, h: 120 };
   case "circle":
     return { w: 130, h: 130 };
   case "desk":
     return { w: 70, h: 50 };
   default:
     return { w: 140, h: 90 };
 }
}


function seatPositions({
 type,
 w,
 h,
 seats,
}: {
 type: "rect" | "square" | "circle" | "desk";
 w: number;
 h: number;
 seats: number;
}) {
 // Coordinates are relative to top-left of the table bounding box.
 const pad = 14;
 const pts = [];


 if (type === "desk") {
   // Single seat above desk.
   pts.push({ x: w / 2, y: -18 });
   return pts;
 }


 if (type === "circle") {
   const r = Math.min(w, h) / 2;
   const cx = w / 2;
   const cy = h / 2;
   const ring = r + 18;
   for (let i = 0; i < seats; i++) {
     const a = (-Math.PI / 2) + (i * (2 * Math.PI)) / seats;
     pts.push({ x: cx + ring * Math.cos(a), y: cy + ring * Math.sin(a) });
   }
   return pts;
 }


 // Rect / Square: distribute seats around perimeter (elementary table groups)
 // Order: top, right, bottom, left.
 const topCount = Math.ceil(seats / 4);
 const rightCount = Math.floor((seats - topCount) / 3);
 const bottomCount = Math.ceil((seats - topCount - rightCount) / 2);
 const leftCount = seats - topCount - rightCount - bottomCount;


 const spread = (count: number, len: number): number[] => {
   if (count <= 0) return [];
   if (count === 1) return [len / 2];
   const step = len / (count + 1);
   return Array.from({ length: count }, (_, i) => step * (i + 1));
 };


 // top
 for (const x of spread(topCount, w - pad * 2)) pts.push({ x: pad + x, y: -18 });
 // right
 for (const y of spread(rightCount, h - pad * 2)) pts.push({ x: w + 18, y: pad + y });
 // bottom
 for (const x of spread(bottomCount, w - pad * 2)) pts.push({ x: pad + x, y: h + 18 });
 // left
 for (const y of spread(leftCount, h - pad * 2)) pts.push({ x: -18, y: pad + y });


 return pts.slice(0, seats);
}


function shapeLabel(type: string): string {
 switch (type) {
   case "rect":
     return "Rectangle Table";
   case "square":
     return "Square Table";
   case "circle":
     return "Round Table";
   case "desk":
     return "Desk";
   default:
     return "Table";
 }
}


export default function SeatingChartBuilder() {
 const stageWrapRef = useRef<HTMLDivElement | null>(null);


 const [meta, setMeta] = useState({ className: "", date: "" });
 const [studentsText, setStudentsText] = useState(
   "Ava\nBen\nCamila\nDiego\nEthan\nFatima\nGrace\nHugo\nIsabella\nJamal\nKai\nLuna"
 );


 const [students, setStudents] = useState(() => {
   return "Ava\nBen\nCamila\nDiego\nEthan\nFatima\nGrace\nHugo\nIsabella\nJamal\nKai\nLuna"
     .split("\n")
     .map((n) => n.trim())
     .filter(Boolean)
     .map((name) => ({ id: uid(), name }));
 });


 const [tables, setTables] = useState<Table[]>([]);
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [assignments, setAssignments] = useState<Assignments>({});
 const [viewport, setViewport] = useState({ w: 900, h: 560 });


 // Derived
 const studentById = useMemo(() => {
   const m = new Map();
   students.forEach((s) => m.set(s.id, s));
   return m;
 }, [students]);


 const seatedStudentIds = useMemo(() => new Set(Object.values(assignments)), [assignments]);


 const unseated = useMemo(
   () => students.filter((s) => !seatedStudentIds.has(s.id)),
   [students, seatedStudentIds]
 );


 const selected = useMemo(() => tables.find((t) => t.id === selectedId) || null, [tables, selectedId]);


 // Load/save
 useEffect(() => {
   try {
     const raw = localStorage.getItem(STORAGE_KEY);
     if (!raw) return;
     const data = JSON.parse(raw);
     if (data?.tables) setTables(data.tables);
     if (data?.assignments) setAssignments(data.assignments);
     if (data?.students) setStudents(data.students);
     if (data?.meta) setMeta(data.meta);
     if (data?.studentsText) setStudentsText(data.studentsText);
   } catch {}
 }, []);


 useEffect(() => {
   const data = { tables, assignments, students, meta, studentsText };
   try {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
   } catch {}
 }, [tables, assignments, students, meta, studentsText]);


 // Responsive viewport sizing
 useEffect(() => {
   const el = stageWrapRef.current;
   if (!el) return;
   const ro = new ResizeObserver(() => {
     const r = el.getBoundingClientRect();
     setViewport({ w: Math.max(520, Math.floor(r.width)), h: Math.max(420, Math.floor(r.height)) });
   });
   ro.observe(el);
   return () => ro.disconnect();
 }, []);


 function addTable(type: "rect" | "square" | "circle" | "desk") {
   const { w, h } = defaultSizeFor(type);
   const id = uid();
   const t = {
     id,
     type,
     name: type === "desk" ? "Desk" : "Table",
     x: snap(120 + tables.length * 20),
     y: snap(120 + tables.length * 20),
     w,
     h,
     seats: defaultSeatsFor(type),
     rotation: 0,
   };
   setTables((prev) => [...prev, t]);
   setSelectedId(id);
 }


 function deleteSelected() {
   if (!selected) return;
   const keep = tables.filter((t) => t.id !== selected.id);
   setTables(keep);
   setSelectedId(null);
   // Remove seat assignments for that table
   setAssignments((prev) => {
     const next = { ...prev };
     Object.keys(next)
       .filter((k) => k.startsWith(selected.id + "-s"))
       .forEach((k) => delete next[k]);
     return next;
   });
 }


 function clearAll() {
   setTables([]);
   setAssignments({});
   setSelectedId(null);
 }


 function reseatClear() {
   setAssignments({});
 }


 function updateSelected(patch: Partial<Table>) {
   if (!selected) return;
   setTables((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
 }


 function onStudentDragStart(
 e: React.DragEvent<HTMLElement>,
 studentId: string
) {
   e.dataTransfer.setData("application/x-student-id", studentId);
   e.dataTransfer.effectAllowed = "move";
 }


 function unassignStudent(studentId: string) {
   setAssignments((prev) => {
     const next = { ...prev };
     for (const [seatId, sid] of Object.entries(next)) {
       if (sid === studentId) delete next[seatId];
     }
     return next;
   });
 }


 function handleDropToStage(e: React.DragEvent<HTMLDivElement>) {
   e.preventDefault();
   const studentId = e.dataTransfer.getData("application/x-student-id");
   if (!studentId) return;


   // If dropped on stage but not on a seat, do nothing.
   // Seats handle their own drop via nearest-seat logic below.


   // We'll do nearest-seat detection here:
   const wrap = stageWrapRef.current;
   if (!wrap) return;
   const rect = wrap.getBoundingClientRect();


   const px = e.clientX - rect.left;
   const py = e.clientY - rect.top;


   // Find closest seat center among all seats
   let best = null;
   for (const t of tables) {
     const { w, h } = defaultSizeFor(t.type);


const pts = seatPositions({
 type: t.type,
 w,
 h,
 seats: t.seats,
});
     for (let i = 0; i < pts.length; i++) {
       const seatId = `${t.id}-s${i}`;
       const cx = t.x + pts[i].x;
       const cy = t.y + pts[i].y;
       const d2 = (cx - px) ** 2 + (cy - py) ** 2;
       if (!best || d2 < best.d2) best = { seatId, d2 };
     }
   }


   const MAX_D2 = 28 ** 2; // drop radius
   if (!best || best.d2 > MAX_D2) return;


   setAssignments((prev) => {
     // prevent duplicates: unassign student elsewhere
     const next = { ...prev };
     for (const [seatId, sid] of Object.entries(next)) {
       if (sid === studentId) delete next[seatId];
     }
     next[best.seatId] = studentId;
     return next;
   });
 }


 function handleDragOverStage(e: React.DragEvent<HTMLDivElement>) {
   e.preventDefault();
   e.dataTransfer.dropEffect = "move";
 }


 function printNow() {
   window.print();
 }


 function applyRoster() {
   const names = studentsText
     .split("\n")
     .map((n) => n.trim())
     .filter(Boolean);


   // Preserve existing IDs where possible by matching names (simple approach)
   setStudents((prev) => {
     const byName = new Map(prev.map((s) => [s.name.toLowerCase(), s]));
     const next = names.map((name) => byName.get(name.toLowerCase()) || { id: uid(), name });
     return next;
   });


   // Remove assignments for students no longer in roster
   setAssignments((prev) => {
     const next = { ...prev };
     const keepIds = new Set(names.map((n) => n.toLowerCase()));
     for (const [seatId, sid] of Object.entries(next)) {
       const st = studentById.get(sid);
       if (!st || !keepIds.has(st.name.toLowerCase())) delete next[seatId];
     }
     return next;
   });
 }


 const Header = () => (
   <div className="no-print flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
     <div className="flex items-center gap-3">
       <div className="text-lg font-semibold">Seating Chart Builder</div>
       <div className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Free Prototype</div>
     </div>
     <div className="flex items-center gap-2">
       <button
         className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
         onClick={reseatClear}
         title="Clear all seat assignments"
       >
         Clear Seats
       </button>
       <button
         className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
         onClick={clearAll}
         title="Remove all tables/desks"
       >
         Clear Room
       </button>
       <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={printNow}>
         Print
       </button>
     </div>
   </div>
 );


 const Sidebar = () => (
   <div className="no-print w-[340px] shrink-0 border-r bg-white p-4">
     <div className="mb-4">
       <div className="text-sm font-semibold">Class info</div>
       <div className="mt-2 grid grid-cols-2 gap-2">
         <input
           className="w-full rounded-xl border px-3 py-2 text-sm"
           placeholder="Class name"
           value={meta.className}
           onChange={(e) => setMeta((m) => ({ ...m, className: e.target.value }))}
         />
         <input
           className="w-full rounded-xl border px-3 py-2 text-sm"
           placeholder="Date"
           value={meta.date}
           onChange={(e) => setMeta((m) => ({ ...m, date: e.target.value }))}
         />
       </div>
     </div>


     <div className="mb-4">
       <div className="text-sm font-semibold">Add furniture</div>
       <div className="mt-2 grid grid-cols-2 gap-2">
         <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addTable("rect")}>
           + Rectangle
         </button>
         <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addTable("square")}>
           + Square
         </button>
         <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addTable("circle")}>
           + Circle
         </button>
         <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addTable("desk")}>
           + Desk
         </button>
       </div>
     </div>


     <div className="mb-4">
       <div className="flex items-center justify-between">
         <div className="text-sm font-semibold">Roster</div>
         <button className="text-xs text-slate-600 hover:underline" onClick={applyRoster}>
           Apply
         </button>
       </div>
       <div className="mt-2 text-xs text-slate-500">Paste one student per line.</div>
       <textarea
         className="mt-2 h-28 w-full rounded-xl border px-3 py-2 text-sm"
         value={studentsText}
         onChange={(e) => setStudentsText(e.target.value)}
       />
     </div>


     <div className="mb-2 text-sm font-semibold">Drag students onto seat dots</div>
     <div className="max-h-[280px] overflow-auto rounded-xl border bg-slate-50 p-2">
       {unseated.length === 0 ? (
         <div className="p-2 text-sm text-slate-500">All students are seated 🎉</div>
       ) : (
         <div className="flex flex-wrap gap-2">
           {unseated.map((s) => (
             <div
               key={s.id}
               draggable
               onDragStart={(e) => onStudentDragStart(e, s.id)}
               className="cursor-grab rounded-full bg-white px-3 py-1 text-sm shadow-sm ring-1 ring-slate-200 hover:shadow"
               title="Drag onto a seat"
             >
               {s.name}
             </div>
           ))}
         </div>
       )}
     </div>


     <div className="mt-4 rounded-xl border bg-white p-3">
       <div className="text-sm font-semibold">Tips</div>
       <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
         <li>Click a table to edit its name and seat count.</li>
         <li>Drag furniture to rearrange (it snaps to the grid).</li>
         <li>Drag a seated student name to the roster panel to unseat (or use “Clear Seats”).</li>
         <li>Use Print to get a clean page without toolbars.</li>
       </ul>
     </div>
   </div>
 );


 const Properties = () => (
   <div className="no-print w-[320px] shrink-0 border-l bg-white p-4">
     <div className="text-sm font-semibold">Selected</div>
     {!selected ? (
       <div className="mt-2 text-sm text-slate-500">Click a table or desk to edit.</div>
     ) : (
       <div className="mt-3 space-y-3">
         <div className="rounded-xl border p-3">
           <div className="text-xs text-slate-500">Type</div>
           <div className="text-sm font-medium">{shapeLabel(selected.type)}</div>
         </div>


         <div>
           <div className="text-xs font-semibold text-slate-600">Label</div>
           <input
             className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
             value={selected.name}
             onChange={(e) => updateSelected({ name: e.target.value })}
           />
         </div>


         <div>
           <div className="text-xs font-semibold text-slate-600">Seats</div>
           <input
             type="number"
             min={1}
             max={12}
             className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
             value={selected.seats}
             onChange={(e) => {
               const v = clamp(parseInt(e.target.value || "1", 10), 1, 12);
               updateSelected({ seats: v });
             }}
             disabled={selected.type === "desk"}
           />
           {selected.type === "desk" && <div className="mt-1 text-xs text-slate-500">Desks have 1 seat.</div>}
         </div>


         <div className="grid grid-cols-2 gap-2">
           <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => updateSelected({ rotation: (selected.rotation + 90) % 360 })}>
             Rotate 90°
           </button>
           <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={deleteSelected}>
             Delete
           </button>
         </div>


         <div className="rounded-xl border bg-slate-50 p-3">
           <div className="text-xs font-semibold text-slate-600">Seated here</div>
           <div className="mt-2 space-y-2">
             {seatPositions(selected).map((_, i) => {
               const seatId = `${selected.id}-s${i}`;
               const sid = assignments[seatId];
               const s = sid ? studentById.get(sid) : null;
               return (
                 <div key={seatId} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                   <div className="text-slate-500">Seat {i + 1}</div>
                   <div className={s ? "font-medium" : "text-slate-400"}>{s ? s.name : "—"}</div>
                 </div>
               );
             })}
           </div>
           <div className="mt-2 text-xs text-slate-500">To unseat, drag the name from the chart back to the roster area, or clear seats.</div>
         </div>
       </div>
     )}
   </div>
 );


 // Render seat circles + names for a table
 function TableNode({ t }: { t: Table }) {
   const isSelected = t.id === selectedId;
   const pts = seatPositions(t);


   const fill = "#F8FAFC";
   const stroke = isSelected ? "#0F172A" : "#CBD5E1";


   return (
     <Group
       x={t.x}
       y={t.y}
       rotation={t.rotation}
       draggable
       onDragMove={(e) => {
         const nx = snap(e.target.x());
         const ny = snap(e.target.y());
         e.target.x(nx);
         e.target.y(ny);
       }}
       onDragEnd={(e) => {
         const nx = snap(e.target.x());
         const ny = snap(e.target.y());
         setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, x: nx, y: ny } : x)));
       }}
       onMouseDown={(e) => {
         e.cancelBubble = true;
         setSelectedId(t.id);
       }}
     >
       {t.type === "circle" ? (
         <Circle x={t.w / 2} y={t.h / 2} radius={Math.min(t.w, t.h) / 2} fill={fill} stroke={stroke} strokeWidth={2} />
       ) : (
         <Rect width={t.w} height={t.h} cornerRadius={14} fill={fill} stroke={stroke} strokeWidth={2} />
       )}


       {/* Label */}
       <Text
         text={t.name}
         x={10}
         y={t.h / 2 - 9}
         width={t.w - 20}
         align="center"
         fontSize={14}
         fill="#0F172A"
       />


       {/* Seats */}
       {pts.map((p, i) => {
         const seatId = `${t.id}-s${i}`;
         const sid = assignments[seatId];
         const s = sid ? studentById.get(sid) : null;
         const seatFill = s ? "#0EA5E9" : "#E2E8F0";
         const seatStroke = s ? "#0284C7" : "#94A3B8";


         return (
           <Group key={seatId} x={p.x} y={p.y}>
             <Circle radius={12} fill={seatFill} stroke={seatStroke} strokeWidth={2} />
             {s && (
               <Text
                 text={s.name}
                 x={-60}
                 y={16}
                 width={120}
                 align="center"
                 fontSize={12}
                 fill="#0F172A"
                 listening={false}
               />
             )}
           </Group>
         );
       })}
     </Group>
   );
 }


 const PrintHeader = () => (
   <div className="print-only hidden p-4">
     <div className="flex items-end justify-between">
       <div>
         <div className="text-xl font-semibold">Seating Chart</div>
         <div className="text-sm text-slate-600">{meta.className || "Class"}</div>
       </div>
       <div className="text-sm text-slate-600">{meta.date || ""}</div>
     </div>
     <div className="mt-3 h-px w-full bg-slate-200" />
   </div>
 );


 return (
   <div className="min-h-screen bg-slate-50 text-slate-900">
     <style>{`
       @media print {
         .no-print { display: none !important; }
         .print-only { display: block !important; }
         body { background: white !important; }
         #stageWrap { border: none !important; }
       }
     `}</style>


     <Header />


     <div className="flex">
       <Sidebar />


       <div className="flex-1 p-4">
         <div className="rounded-2xl border bg-white shadow-sm">
           <PrintHeader />


           <div
             id="stageWrap"
             ref={stageWrapRef}
             className="relative h-[72vh] min-h-[520px] w-full rounded-2xl"
             onDrop={handleDropToStage}
             onDragOver={handleDragOverStage}
           >
             {/* grid overlay */}
             <div
               className="pointer-events-none absolute inset-0 rounded-2xl"
               style={{
                 backgroundImage:
                   "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
                 backgroundSize: `${GRID}px ${GRID}px`,
               }}
             />


             <Stage
               width={viewport.w}
               height={viewport.h}
               onMouseDown={() => setSelectedId(null)}
               style={{ position: "absolute", inset: 0 }}
             >
               <Layer>
                 {tables.map((t) => (
                   <TableNode key={t.id} t={t} />
                 ))}
               </Layer>
             </Stage>
           </div>


           {/* Seated students legend (prints nicely) */}
           <div className="print-only hidden px-4 pb-4">
             <div className="mt-4 text-sm font-semibold">Seated Students</div>
             <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
               {tables.flatMap((t) => {
                 const pts = seatPositions(t);
                 return pts.map((_, i) => {
                   const seatId = `${t.id}-s${i}`;
                   const sid = assignments[seatId];
                   const s = sid ? studentById.get(sid) : null;
                   return {
                     key: seatId,
                     table: t.name,
                     seat: i + 1,
                     name: s?.name || "—",
                   };
                 });
               }).map((row) => (
                 <div key={row.key} className="rounded-xl border bg-white px-3 py-2">
                   <div className="text-xs text-slate-500">{row.table} • Seat {row.seat}</div>
                   <div className="font-medium">{row.name}</div>
                 </div>
               ))}
             </div>
           </div>


           <div className="no-print px-4 pb-4">
             <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
               <span className="font-semibold">Quick workflow:</span> Add tables → paste roster → drag names onto seat dots → Print.
             </div>
           </div>
         </div>
       </div>


       <Properties />
     </div>
   </div>
 );
}
