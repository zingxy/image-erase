import { useEffect, useRef } from 'react';
import './App.css';
import { Scene } from './scens';
import imgSrc from './image.jpg';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  useEffect(() => {
    if (canvasRef.current) {
      const scene = new Scene(canvasRef.current);
      sceneRef.current = scene;
      window['scene'] = scene;
      const image = new Image();
      image.src = imgSrc;
      image.onload = () => {
        scene.load(image);
      };
      if (contRef.current) {
        contRef.current.appendChild(scene.maskCanvas);
        document.body.appendChild(scene.outputCanvas);
      }
    }
  }, []);

  return (
    <div
      ref={contRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        border: '2px solid black',
      }}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: '2px solid black' }}
      />
    </div>
  );
}

export default App;
