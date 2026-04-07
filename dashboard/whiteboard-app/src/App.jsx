import { useState, useRef, useCallback } from 'react'
import { Excalidraw, exportToCanvas } from "@excalidraw/excalidraw"
import './App.css'

function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const saveTimeoutRef = useRef(null);
  
  const saveImage = async (elements, appState, files) => {
    if (!elements || elements.length === 0) return;
    
    try {
      // Export current drawing to canvas
      const canvas = await exportToCanvas({
        elements,
        appState,
        files,
        getDimensions: () => { return {width: appState.width, height: appState.height} }
      });
      
      const dataURL = canvas.toDataURL("image/png");
      
      // POST to our dashboard backend
      fetch('/api/whiteboard/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataURL })
      }).catch(err => console.error("Whiteboard save failed:", err));
      
    } catch (e) {
      console.error("Failed to generate image", e);
    }
  };

  const onChange = useCallback((elements, appState, files) => {
    // Debounce saves — only save after 1.5 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveImage(elements, appState, files);
    }, 1500);
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
      <Excalidraw 
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={onChange}
        UIOptions={{
          canvasActions: { export: false, loadScene: false, saveAsImage: false }
        }}
      />
    </div>
  )
}

export default App
