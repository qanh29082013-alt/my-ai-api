"""
AI API - Powered by Groq (Free!)
"""
import os, uuid, tempfile, json
from datetime import datetime
from typing import Optional
from pathlib import Path
from groq import Groq
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

app = FastAPI(title="🤖 AI API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"
sessions: dict[str, list] = {}

class ChatRequest(BaseModel):
    user_id: str = "default"
    message: str
    system_prompt: Optional[str] = None
    reset: bool = False

class CodeRequest(BaseModel):
    user_id: str = "default"
    task: str
    language: str = "python"
    optimize_level: str = "maximum"

class PowerPointRequest(BaseModel):
    title: str
    topic: str
    slides: Optional[list[dict]] = None
    num_slides: int = 5
    style: str = "professional"

BASE_SYSTEM = """Bạn là một AI thông minh, thân thiện và cực kỳ có ích.
- Trả lời ngắn gọn, rõ ràng
- Làm ĐÚNG theo lệnh người dùng
- Thân thiện như người bạn
- Trả lời bằng tiếng Việt trừ khi được yêu cầu khác"""

CODE_SYSTEM = """Bạn là senior engineer viết code cực kỳ tối ưu và sạch.
- Đúng logic, không có bug
- Tối ưu thuật toán (Big-O tốt nhất)
- Clean code với comment ngắn gọn
- Xử lý edge case đầy đủ"""

PPTX_SYSTEM = """Tạo nội dung slide PowerPoint. Trả về JSON THUẦN TÚY:
{"slides":[{"title":"...","points":["...","..."],"note":"..."}]}"""

def call_ai(messages, system, max_tokens=2048):
    r = client.chat.completions.create(
        model=MODEL, max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}] + messages)
    return r.choices[0].message.content

STYLES = {
    "professional": {"bg": RGBColor(0x1A,0x1A,0x2E),"title_bg": RGBColor(0x16,0x21,0x3E),"accent": RGBColor(0x0F,0x3A,0x5E),"title_color": RGBColor(0xE0,0xF7,0xFF),"text_color": RGBColor(0xCC,0xE5,0xFF),"bullet_color": RGBColor(0x4F,0xC3,0xF7),"font_title":"Calibri","font_body":"Calibri Light"},
    "modern": {"bg": RGBColor(0xF8,0xF9,0xFA),"title_bg": RGBColor(0x21,0x29,0x5C),"accent": RGBColor(0xF9,0x61,0x67),"title_color": RGBColor(0xFF,0xFF,0xFF),"text_color": RGBColor(0x2D,0x3A,0x4A),"bullet_color": RGBColor(0xF9,0x61,0x67),"font_title":"Trebuchet MS","font_body":"Calibri"},
    "minimal": {"bg": RGBColor(0xFF,0xFF,0xFF),"title_bg": RGBColor(0x36,0x45,0x4F),"accent": RGBColor(0x02,0xC3,0x9A),"title_color": RGBColor(0xFF,0xFF,0xFF),"text_color": RGBColor(0x36,0x45,0x4F),"bullet_color": RGBColor(0x02,0xC3,0x9A),"font_title":"Cambria","font_body":"Calibri Light"},
    "colorful": {"bg": RGBColor(0xFF,0xF8,0xF0),"title_bg": RGBColor(0xB8,0x50,0x42),"accent": RGBColor(0x02,0x80,0x90),"title_color": RGBColor(0xFF,0xFF,0xFF),"text_color": RGBColor(0x2C,0x1A,0x1A),"bullet_color": RGBColor(0xB8,0x50,0x42),"font_title":"Georgia","font_body":"Calibri"},
}

def set_bg(slide, color):
    f = slide.background.fill; f.solid(); f.fore_color.rgb = color

def add_tb(slide, text, l, t, w, h, fn, fs, color, bold=False, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(l,t,w,h); tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.alignment = align; run = p.add_run()
    run.text = text; run.font.name = fn; run.font.size = Pt(fs)
    run.font.color.rgb = color; run.font.bold = bold; return tb

def create_pptx(title, slides_data, style="professional"):
    s = STYLES.get(style, STYLES["professional"])
    prs = Presentation(); prs.slide_width = Inches(13.33); prs.slide_height = Inches(7.5)
    W = prs.slide_width; H = prs.slide_height
    ts = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(ts, s["bg"])
    bar = ts.shapes.add_shape(1,0,0,Inches(0.5),H); bar.fill.solid(); bar.fill.fore_color.rgb = s["accent"]; bar.line.fill.background()
    add_tb(ts, title, Inches(1),Inches(2.5),Inches(10),Inches(1.8), s["font_title"],44,s["title_color"],True,PP_ALIGN.CENTER)
    add_tb(ts, datetime.now().strftime("%d/%m/%Y"), Inches(1),Inches(4.5),Inches(10),Inches(0.5), s["font_body"],14,s["bullet_color"],align=PP_ALIGN.CENTER)
    for i, si in enumerate(slides_data):
        sl = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(sl, s["bg"])
        hd = sl.shapes.add_shape(1,0,0,W,Inches(1.2)); hd.fill.solid(); hd.fill.fore_color.rgb = s["title_bg"]; hd.line.fill.background()
        add_tb(sl,f"{i+1:02d}",Inches(0.2),Inches(0.1),Inches(0.8),Inches(1.0),s["font_title"],28,s["bullet_color"],True)
        add_tb(sl,si.get("title",""),Inches(1.1),Inches(0.15),Inches(11),Inches(0.9),s["font_title"],26,s["title_color"],True)
        sp = sl.shapes.add_shape(1,0,Inches(1.2),W,Pt(3)); sp.fill.solid(); sp.fill.fore_color.rgb = s["accent"]; sp.line.fill.background()
        for j,pt in enumerate(si.get("points",[])[:6]):
            y = Inches(1.5)+j*Inches(0.72)
            dot = sl.shapes.add_shape(9,Inches(0.6),y+Inches(0.18),Pt(10),Pt(10)); dot.fill.solid(); dot.fill.fore_color.rgb = s["bullet_color"]; dot.line.fill.background()
            add_tb(sl,pt,Inches(1.0),y,Inches(11.5),Inches(0.72),s["font_body"],16,s["text_color"])
        if si.get("note"): add_tb(sl,f"💡 {si['note']}",Inches(0.5),Inches(6.8),Inches(12),Inches(0.5),s["font_body"],11,s["bullet_color"])
        add_tb(sl,f"{i+2}/{len(slides_data)+1}",Inches(11.8),Inches(7.1),Inches(1.3),Inches(0.3),s["font_body"],10,s["bullet_color"],align=PP_ALIGN.RIGHT)
    es = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(es, s["title_bg"])
    add_tb(es,"Cảm ơn!",Inches(1),Inches(3.0),Inches(11),Inches(1.2),s["font_title"],48,s["title_color"],True,PP_ALIGN.CENTER)
    add_tb(es,title,Inches(1),Inches(4.2),Inches(11),Inches(0.6),s["font_body"],18,s["bullet_color"],align=PP_ALIGN.CENTER)
    od = Path(tempfile.gettempdir())/"ai_pptx"; od.mkdir(exist_ok=True)
    fn = od/f"{uuid.uuid4().hex[:8]}_{title[:20].replace(' ','_')}.pptx"; prs.save(str(fn)); return str(fn)

@app.get("/", response_class=HTMLResponse)
def chat_ui():
    f = Path(__file__).parent/"index.html"
    return HTMLResponse(f.read_text(encoding="utf-8") if f.exists() else "<h1>index.html not found</h1>")

@app.get("/api")
def root():
    return {"message": "🤖 AI API (Groq - Free!)", "model": MODEL}

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.reset or req.user_id not in sessions: sessions[req.user_id] = []
    sessions[req.user_id].append({"role":"user","content":req.message})
    reply = call_ai(sessions[req.user_id], req.system_prompt or BASE_SYSTEM)
    sessions[req.user_id].append({"role":"assistant","content":reply})
    return {"user_id":req.user_id,"reply":reply,"turns":len(sessions[req.user_id])//2}

@app.post("/code")
async def generate_code(req: CodeRequest):
    system = CODE_SYSTEM + ("\nƯu tiên tốc độ tối đa, memory tối thiểu." if req.optimize_level=="maximum" else "")
    if req.user_id not in sessions: sessions[req.user_id] = []
    prompt = f"Ngôn ngữ: {req.language}\nYêu cầu: {req.task}"
    sessions[req.user_id].append({"role":"user","content":prompt})
    reply = call_ai(sessions[req.user_id], system, 4096)
    sessions[req.user_id].append({"role":"assistant","content":reply})
    return {"user_id":req.user_id,"language":req.language,"code":reply}

@app.post("/powerpoint")
async def create_powerpoint(req: PowerPointRequest):
    if not req.slides:
        prompt = f"Tạo {req.num_slides} slide:\nTiêu đề: {req.title}\nChủ đề: {req.topic}"
        raw = call_ai([{"role":"user","content":prompt}], PPTX_SYSTEM, 3000)
        try:
            clean = raw.strip()
            if clean.startswith("```"): clean = clean.split("\n",1)[1].rsplit("```",1)[0].strip()
            slides_data = json.loads(clean)["slides"]
        except: raise HTTPException(500, detail=f"Lỗi parse: {raw[:200]}")
    else: slides_data = req.slides
    fp = create_pptx(req.title, slides_data, req.style)
    return FileResponse(fp, filename=f"{req.title.replace(' ','_')}.pptx",
                        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation")

@app.delete("/session/{user_id}")
def reset_session(user_id: str):
    if user_id in sessions: del sessions[user_id]; return {"message": f"Đã xoá {user_id}"}
    return {"message": "Không tìm thấy"}

@app.get("/sessions")
def list_sessions():
    return {uid: {"turns": len(msgs)//2} for uid, msgs in sessions.items()}
