import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FuelFlowSystem } from './js/components/FuelFlowSystem.js';

class FADECSimulation {
    constructor() {
        this.init();
        this.setupScene();
        this.loadModel();
        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.camera.position.set(6, 5, 8);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.clippingPlanes = [];
        this.renderer.shadowMap.enabled = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    setupScene() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light for shadows and highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = false;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Fill light for better illumination
        const fillLight = new THREE.PointLight(0xffffff, 0.5, 30);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = false;
        this.scene.add(ground);
    }

    async loadModel() {
        const loader = new GLTFLoader();
        try {
            // Load the FADEC model
            const gltf = await loader.loadAsync('./models/FadecFinal.glb');
            this.fadecSystem = gltf.scene;
            this.scene.add(this.fadecSystem);

            // Enable shadows for all meshes
            this.fadecSystem.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Register components with correct names from your Blender model
            this.components = {
                // Core components
                Armature: this.fadecSystem.getObjectByName('Armature'),
                FCU: this.fadecSystem.getObjectByName('FCU'),
                FCU_001: this.fadecSystem.getObjectByName('FCU_001'),
                
                // Fuel system pipes (correct names from your specification)
                Fuel_supply_pipe: this.fadecSystem.getObjectByName('Fuel_supply_pipe'),
                Below_Mid_pipe: this.fadecSystem.getObjectByName('Below_Mid_pipe'),
                Left_pipe: this.fadecSystem.getObjectByName('Left_pipe'),
                Right_pipe: this.fadecSystem.getObjectByName('Right_pipe'),
                Mid_Pipe: this.fadecSystem.getObjectByName('Mid_Pipe'),
                Spool_Pipe: this.fadecSystem.getObjectByName('Spool_Pipe'),
                
                // Outputs and controls
                Left_Output: this.fadecSystem.getObjectByName('Left_Output'),
                Right_Output: this.fadecSystem.getObjectByName('Right_Output'),
                Left_solenoid: this.fadecSystem.getObjectByName('Left_solenoid'),
                Right_Solenoid: this.fadecSystem.getObjectByName('Right_Solenoid'),
                
                // Mechanical components
                North_Pole: this.fadecSystem.getObjectByName('North_Pole'),
                South_Pole: this.fadecSystem.getObjectByName('South_Pole'),
                Feedback: this.fadecSystem.getObjectByName('Feedback'),
                Feedback_rod: this.fadecSystem.getObjectByName('Feedback_rod'),
                Feedback_rod_001: this.fadecSystem.getObjectByName('Feedback_rod_001'),
                Land_rod: this.fadecSystem.getObjectByName('Land_rod'),
                
                // Springs and lands
                Left_Land: this.fadecSystem.getObjectByName('Left_Land'),
                Left_Spring: this.fadecSystem.getObjectByName('Left_Spring'),
                Right_Land: this.fadecSystem.getObjectByName('Right_Land'),
                Right_Spring: this.fadecSystem.getObjectByName('Right_Spring'),
                
                // Casings and tank
                Bottom_Casing: this.fadecSystem.getObjectByName('Bottom_Casing'),
                Top_Casing: this.fadecSystem.getObjectByName('Top_Casing'),
                Fuel_Tank: this.fadecSystem.getObjectByName('Fuel_Tank'),
                
                // Drains and vents
                Drain: this.fadecSystem.getObjectByName('Drain'),
                Drain_Nob: this.fadecSystem.getObjectByName('Drain_Nob'),
                Fuel_Intake: this.fadecSystem.getObjectByName('Fuel_Intake'),
                Vent: this.fadecSystem.getObjectByName('Vent'),
                Vent_001: this.fadecSystem.getObjectByName('Vent_001')
            };

            // Add this after component registration for debugging
console.log("Available components:");
Object.entries(this.components).forEach(([key, obj]) => {
    if (obj) {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        console.log(`${key}:`, {
            found: true,
            position: obj.position,
            size: size,
            type: obj.type
        });
    } else {
        console.log(`${key}: NOT FOUND`);
    }
});

            // Log missing components
            Object.entries(this.components).forEach(([key, obj]) => {
            if (!obj) {
                console.warn(`Part not found: ${key}`);
            }
            });

            // Setup control systems FIRST to create fuelMesh
            this.setupFuelTankControl();
            
            // THEN initialize fuel flow system with proper parameters
            this.fuelFlowSystem = new FuelFlowSystem(this.scene, this.components, this.fuelMesh);
            
            // Setup throttle control AFTER fuel flow system is initialized
            this.setupThrottleControl();
        } catch (error) {
            console.error('Could not load FADEC model:', error);
        }
    }

    setupFuelTankControl() {
        const tank = this.components.Fuel_Tank;
        if (!tank) {
            console.error('Fuel Tank object not found!');
            return;
        }

        // Calculate tank dimensions
        const box = new THREE.Box3().setFromObject(tank);
        const tankSize = box.getSize(new THREE.Vector3());
        const tankMin = box.min;
        const tankCenter = box.getCenter(new THREE.Vector3());

        // Create fuel geometry (cuboid to match tank shape)
        const fuelWidth = tankSize.x * 0.96;
        const fuelHeight = tankSize.y * 0.98;
        const fuelDepth = tankSize.z * 0.96;
        const fuelGeometry = new THREE.BoxGeometry(fuelWidth, fuelHeight, fuelDepth);
        
        // Anchor geometry origin at base for proper scaling
        fuelGeometry.translate(0, fuelHeight / 2, 0);

        // Create realistic water material
        const fuelMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x33bbff,
            transparent: true,
            opacity: 0.4,
            transmission: 0.95,
            roughness: 0.05,
            thickness: 0.5,
            reflectivity: 0.7,
            ior: 1.33,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
        });

        // Create and position fuel mesh
        this.fuelMesh = new THREE.Mesh(fuelGeometry, fuelMaterial);
        this.fuelMesh.position.set(tankCenter.x, tankMin.y, tankCenter.z);
        this.scene.add(this.fuelMesh);

        // Disable shadows on fuel mesh
        this.fuelMesh.castShadow = false;
        this.fuelMesh.receiveShadow = false;

        // Store tank properties for animations
        this._tankMinY = tankMin.y;
        this._tankHeight = tankSize.y;

        // Connect fuel quantity slider
        const fuelSlider = document.getElementById('fuelQuantitySlider');
        const fuelValueText = document.getElementById('fuelQuantityValue');
        const initialQuantity = parseInt(fuelSlider.value) || 0;

        // Set initial fuel level
        this.updateFuelLevel(initialQuantity);

        // Handle fuel quantity changes
        fuelSlider.addEventListener('input', (event) => {
            const quantity = parseInt(event.target.value) || 0;
            fuelValueText.textContent = quantity + ' L';
            this.updateFuelLevel(quantity);
        });
    }

    setupThrottleControl() {
    const throttleSlider = document.getElementById('throttle');
    const throttleValueText = document.getElementById('throttle-value');
    const fuelFlowDisplay = document.getElementById('fuel-flow');
    
    throttleSlider.addEventListener('input', (event) => {
        const throttleValue = parseInt(event.target.value) || 0;
        throttleValueText.textContent = throttleValue + '%';
        
        // Calculate and display fuel flow rate
        const fuelFlow = (throttleValue / 100) * 50; // Max 50 L/min
        fuelFlowDisplay.textContent = fuelFlow.toFixed(1) + ' L/min';
        
        // Update fuel flow speed
        if (this.fuelFlowSystem) {
            this.fuelFlowSystem.setFlowSpeed(throttleValue / 100 * 0.002);
        }
        
        // Start or stop fuel flow
        if (throttleValue > 0 && this.fuelFlowSystem && !this.fuelFlowSystem.isFlowing) {
            const fuelSlider = document.getElementById('fuelQuantitySlider');
            const fuelQuantity = parseInt(fuelSlider.value) || 0;
            
            if (fuelQuantity > 0) {
                console.log('Starting flow - Fuel available:', fuelQuantity, 'L');
                this.fuelFlowSystem.startFlow(throttleValue);
            } else {
                console.log('Cannot start flow - no fuel in tank');
            }
        } else if (throttleValue === 0 && this.fuelFlowSystem) {
            this.fuelFlowSystem.stopFlow();
        }
    });
}


    updateFuelLevel(quantity) {
        // Update tank transparency based on fuel quantity
        const tank = this.components.Fuel_Tank;
        if (tank && tank.material) {
            tank.material.transparent = quantity >= 30;
            tank.material.opacity = quantity >= 30 ? 0.3 : 1.0;
            tank.material.needsUpdate = true;
        }

        // Scale fuel mesh to show fill level
        const fuelLevel = Math.max(quantity / 100, 0.01); // Avoid zero scale
        this.fuelMesh.scale.y = fuelLevel;
        
        // Note: Position is not updated because geometry origin is anchored at base
    }

    onWindowResize() {
        // Handle window resize events
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        // Main animation loop
        this.controls.update();
        
        // Update fuel flow system
        if (this.fuelFlowSystem) {
            this.fuelFlowSystem.update();
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the simulation when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    new FADECSimulation();
});
