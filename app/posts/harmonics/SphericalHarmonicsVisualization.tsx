"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

export const SphericalHarmonicsVisualization = () => {
  const [l, setL] = useState(3);
  const [m, setM] = useState(0);
  const [draftL, setDraftL] = useState(3);
  const [draftM, setDraftM] = useState(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Debounced update function
  const debouncedUpdate = useCallback((newL: number, newM: number) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      setL(newL);
      setM(newM);
    }, 100); // 100ms delay
  }, []);

  // Calculate associated Legendre polynomial P_l^m(x)
  const calculateLegendreP = (l: number, m: number, x: number): number => {
    if (m < 0 || m > l) return 0;

    // Handle edge cases
    if (l === 0) return 1;

    // Calculate P_m^m
    let pmm = 1.0;
    const somx2 = Math.sqrt((1 - x) * (1 + x));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2.0;
    }

    if (l === m) return pmm;

    // Calculate P_(m+1)^m
    let pmmp1 = x * (2 * m + 1) * pmm;
    if (l === m + 1) return pmmp1;

    // Calculate P_l^m using recurrence formula
    let pll = 0.0;
    for (let ll = m + 2; ll <= l; ll++) {
      pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
      pmm = pmmp1;
      pmmp1 = pll;
    }

    return pll;
  };

  // Calculate spherical harmonic Y(l,m)
  const calculateYlm = (l: number, m: number, theta: number, phi: number) => {
    const cosTheta = Math.cos(theta);
    // Normalization including m dependence
    const norm = Math.sqrt(
      ((2 * l + 1) * factorial(l - Math.abs(m))) /
        (4 * Math.PI * factorial(l + Math.abs(m)))
    );

    const legendre = calculateLegendreP(l, Math.abs(m), cosTheta);

    // e^(imφ) = cos(mφ) + i*sin(mφ)
    const real = Math.cos(m * phi);

    // For m < 0, multiply by (-1)^m
    const mSign = m < 0 ? (Math.abs(m) % 2 === 0 ? 1 : -1) : 1;

    // Return real part for visualization
    return norm * legendre * real * mSign;
  };

  // Helper function to calculate factorial
  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };

  // Convert function value to color using the plasma colormap
  const valueToColor = (value: number) => {
    // Normalize value to [0, 1] range
    const normalized = (Math.max(-1, Math.min(1, value)) + 1) / 2;
    return new THREE.Color().setHSL(
      0.8 - normalized * 0.7, // Hue: purple to yellow
      0.8, // Saturation
      0.3 + normalized * 0.4 // Lightness
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xffffff);

    // Setup camera
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = Math.min(containerWidth, window.innerHeight * 0.8);
    const camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.z = 2;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(containerWidth, containerHeight);
    containerRef.current.appendChild(renderer.domElement);

    const updateSphere = () => {
      // Create sphere geometry
      const geometry = new THREE.SphereGeometry(1, 512, 512);
      const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 20,
        emissive: new THREE.Color(0x222222),
      });

      // Apply spherical harmonics colors
      const colors: THREE.Color[] = [];
      const positions = geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        // Convert to spherical coordinates
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.acos(z / r);
        const phi = Math.atan2(y, x);

        // Calculate spherical harmonic value
        const value = calculateYlm(l, m, theta, phi);
        colors.push(valueToColor(value));
      }

      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          colors.flatMap((color) => [color.r, color.g, color.b]),
          3
        )
      );

      // Remove old sphere if it exists
      if (sphereRef.current) {
        scene.remove(sphereRef.current);
        sphereRef.current.geometry.dispose();
        (sphereRef.current.material as THREE.Material).dispose();
      }

      // Create new sphere mesh
      const sphere = new THREE.Mesh(geometry, material);
      sphereRef.current = sphere;
      scene.add(sphere);
    };

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);

    updateSphere();

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 15.0;

    // Disable zooming and panning
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 2;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!camera || !renderer || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = Math.min(width, window.innerHeight * 0.8);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      if (sphereRef.current) {
        sphereRef.current.geometry.dispose();
        (sphereRef.current.material as THREE.Material).dispose();
      }
      controls.dispose();
    };
  }, [l, m]); // Re-run effect when l or m changes

  return (
    <div className="w-full flex flex-col items-center">
      <div className="mb-8 flex gap-12 items-center">
        <div className="flex flex-col items-center">
          <label className="text-lg font-medium mb-2">
            <InlineMath math={`\\ell = ${draftL}`} />
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={draftL}
            onChange={(e) => {
              const newL = parseInt(e.target.value);
              setDraftL(newL);
              if (Math.abs(draftM) > newL) {
                const newM = 0;
                setDraftM(newM);
                debouncedUpdate(newL, newM);
              } else {
                debouncedUpdate(newL, draftM);
              }
            }}
            className="w-48 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="text-lg font-medium mb-2">
            <InlineMath math={`m = ${draftM}`} />
          </label>
          <input
            type="range"
            min={-draftL}
            max={draftL}
            value={draftM}
            onChange={(e) => {
              const newM = parseInt(e.target.value);
              setDraftM(newM);
              debouncedUpdate(draftL, newM);
            }}
            className="w-48 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: "auto" }} />
    </div>
  );
};