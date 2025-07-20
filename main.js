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

        // Solenoid control state
        this.leftSolenoidActive = false;
        this.rightSolenoidActive = false;
        this.leftSolenoidCurrent = 0;
        this.rightSolenoidCurrent = 0;

        // Feedback rod and land assembly properties
        this.feedbackRodRotation = 0;
        this.targetFeedbackRodRotation = 0;
        this.maxRotationAngle = Math.PI / 72; // ~2.5 degrees
        this.rotationSmoothing = 0.08;

        // Movement properties (reduced distance)
        this.landAssemblyPosition = 0;
        this.targetLandAssemblyPosition = 0;
        this.maxLandMovement = 0.08; // Reduced movement
        this.landMovementSmoothing = 0.08;

        // Spring properties
        this.leftSpringScale = 1.0;
        this.rightSpringScale = 1.0;
        this.targetLeftSpringScale = 1.0;
        this.targetRightSpringScale = 1.0;
        this.maxSpringCompression = 0.3; // 30% compression
        this.maxSpringExtension = 1.5;   // 50% extension
        this.springSmoothing = 0.08;

        // Misc state
        this.solenoidMaterials = {};
        this.modelLoaded = false;
        this.components = {};
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        this.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth * 0.7 / window.innerHeight, 0.1, 1000
        );
        this.camera.position.set(6, 5, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const canvasContainer = document.getElementById('canvas-container');
        this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
        this.renderer.shadowMap.enabled = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvasContainer.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    setupScene() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        const fillLight = new THREE.PointLight(0xffffff, 0.5, 30);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);

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
            const gltf = await loader.loadAsync('./models/fadecjoined.glb');
            this.fadecSystem = gltf.scene;
            this.scene.add(this.fadecSystem);

            this.fadecSystem.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.components = {
                FCU: this.fadecSystem.getObjectByName('FCU'),
                FCU_001: this.fadecSystem.getObjectByName('FCU_001'),
                Fuel_supply_pipe: this.fadecSystem.getObjectByName('Fuel_supply_pipe'),
                Below_Mid_pipe: this.fadecSystem.getObjectByName('Below_Mid_pipe'),
                Left_pipe: this.fadecSystem.getObjectByName('Left_pipe'),
                Right_pipe: this.fadecSystem.getObjectByName('Right_pipe'),
                Mid_Pipe: this.fadecSystem.getObjectByName('Mid_Pipe'),
                Spool_Pipe: this.fadecSystem.getObjectByName('Spool_Pipe'),
                Left_Output: this.fadecSystem.getObjectByName('Left_Output'),
                Right_Output: this.fadecSystem.getObjectByName('Right_Output'),
                Left_solenoid: this.fadecSystem.getObjectByName('Left_solenoid'),
                Right_Solenoid: this.fadecSystem.getObjectByName('Right_Solenoid'),
                North_Pole: this.fadecSystem.getObjectByName('North_Pole'),
                South_Pole: this.fadecSystem.getObjectByName('South_Pole'),
                Feedback_rod_001: this.fadecSystem.getObjectByName('Feedback_rod_001'),
                Land_rod: this.fadecSystem.getObjectByName('Land_rod'),
                Left_Land: this.fadecSystem.getObjectByName('Left_Land'),
                Right_Land: this.fadecSystem.getObjectByName('Right_Land'),
                Bottom_Casing: this.fadecSystem.getObjectByName('Bottom_Casing'),
                Top_Casing: this.fadecSystem.getObjectByName('Top_Casing'),
                Fuel_Tank: this.fadecSystem.getObjectByName('Fuel_Tank'),
                Drain: this.fadecSystem.getObjectByName('Drain'),
                Drain_Nob: this.fadecSystem.getObjectByName('Drain_Nob'),
                Fuel_Intake: this.fadecSystem.getObjectByName('Fuel_Intake'),
                Vent: this.fadecSystem.getObjectByName('Vent'),
                Vent_001: this.fadecSystem.getObjectByName('Vent_001')
            };
            this.storeInitialStates();
            this.setupMidPipeTransparency();
            this.setupSolenoidMaterials();
            this.setupFuelTankControl();
            this.setupSolenoidControls();
            this.fuelFlowSystem = new FuelFlowSystem(this.scene, this.components, this.fuelMesh);
            this.setupThrottleControl();
            this.modelLoaded = true;
            // Hide loading screen after model is loaded
            document.getElementById('loading-screen').style.display = 'none';
        } catch (error) {
            console.error('Could not load FADEC model:', error);
        }
    }

    storeInitialStates() {
        if (this.components.Feedback_rod_001)
            this.initialFeedbackRodRotation = this.components.Feedback_rod_001.rotation.clone();
        if (this.components.Left_Land)
            this.initialLeftLandPosition = this.components.Left_Land.position.clone();
        if (this.components.Right_Land)
            this.initialRightLandPosition = this.components.Right_Land.position.clone();
        if (this.components.Land_rod)
            this.initialLandRodPosition = this.components.Land_rod.position.clone();
    }

    setupMidPipeTransparency() {
        if (this.components.Mid_Pipe) {
            const midPipe = this.components.Mid_Pipe;
            if (midPipe.isMesh) {
                if (midPipe.material) {
                    midPipe.material.transparent = true;
                    midPipe.material.opacity = 0.6;
                    midPipe.material.needsUpdate = true;
                } else {
                    midPipe.material = new THREE.MeshPhongMaterial({
                        color: 0x888888, transparent: true, opacity: 0.6
                    });
                }
            } else {
                midPipe.traverse((child) => {
                    if (child.isMesh) {
                        if (child.material) {
                            child.material.transparent = true;
                            child.material.opacity = 0.6;
                            child.material.needsUpdate = true;
                        } else {
                            child.material = new THREE.MeshPhongMaterial({
                                color: 0x888888, transparent: true, opacity: 0.6
                            });
                        }
                    }
                });
            }
        }
    }

    setupSolenoidMaterials() {
        if (this.components.Left_solenoid) {
            const leftSolenoid = this.components.Left_solenoid;
            if (leftSolenoid.material) {
                this.solenoidMaterials.left = leftSolenoid.material.clone();
            } else {
                this.solenoidMaterials.left = new THREE.MeshPhongMaterial({ color: 0x808080 });
                leftSolenoid.material = this.solenoidMaterials.left;
            }
        }
        if (this.components.Right_Solenoid) {
            const rightSolenoid = this.components.Right_Solenoid;
            if (rightSolenoid.material) {
                this.solenoidMaterials.right = rightSolenoid.material.clone();
            } else {
                this.solenoidMaterials.right = new THREE.MeshPhongMaterial({ color: 0x808080 });
                rightSolenoid.material = this.solenoidMaterials.right;
            }
        }
    }

    setupSolenoidControls() {
        const controlsDiv = document.querySelector('.controls') || document.body;
        const solenoidControlsDiv = document.createElement('div');
        solenoidControlsDiv.className = 'solenoid-controls';
        solenoidControlsDiv.innerHTML = `
          <div style="margin: 20px 0; padding: 15px; border: 2px solid #333; border-radius: 8px; background: #f5f5f5;">
            <h3 style="margin-top: 0;">Solenoid Control System</h3>
            <div class="control-group" style="margin: 10px 0;">
              <label for="leftSolenoidCurrent">Left Solenoid Current:</label>
              <input type="range" id="leftSolenoidCurrent" min="0" max="100" value="0" step="1">
              <span id="leftSolenoidValue">0%</span>
              <button id="leftSolenoidToggle" style="margin-left: 10px; padding: 5px 10px;">OFF</button>
            </div>
            <div class="control-group" style="margin: 10px 0;">
              <label for="rightSolenoidCurrent">Right Solenoid Current:</label>
              <input type="range" id="rightSolenoidCurrent" min="0" max="100" value="0" step="1">
              <span id="rightSolenoidValue">0%</span>
              <button id="rightSolenoidToggle" style="margin-left: 10px; padding: 5px 10px;">OFF</button>
            </div>
            <div class="control-group" style="margin: 10px 0;">
              <label for="rotationSpeed">Feedback Rod Response Speed:</label>
              <input type="range" id="rotationSpeed" min="0.01" max="0.2" value="0.08" step="0.01">
              <span id="rotationSpeedValue">0.08</span>
            </div>
          </div>
        `;
        controlsDiv.appendChild(solenoidControlsDiv);
        this.setupSolenoidEventListeners();
    }

    setupSolenoidEventListeners() {
        const leftCurrentSlider = document.getElementById('leftSolenoidCurrent');
        const leftValueSpan = document.getElementById('leftSolenoidValue');
        const leftToggleBtn = document.getElementById('leftSolenoidToggle');
        const rightCurrentSlider = document.getElementById('rightSolenoidCurrent');
        const rightValueSpan = document.getElementById('rightSolenoidValue');
        const rightToggleBtn = document.getElementById('rightSolenoidToggle');
        const speedSlider = document.getElementById('rotationSpeed');
        const speedValue = document.getElementById('rotationSpeedValue');
        leftCurrentSlider.addEventListener('input', (e) => {
            this.leftSolenoidCurrent = parseInt(e.target.value);
            leftValueSpan.textContent = this.leftSolenoidCurrent + '%';
            this.updateFeedbackRodRotation();
            this.updateSolenoidVisuals();
        });
        leftToggleBtn.addEventListener('click', () => {
            this.leftSolenoidActive = !this.leftSolenoidActive;
            leftToggleBtn.textContent = this.leftSolenoidActive ? 'ON' : 'OFF';
            leftToggleBtn.style.backgroundColor = this.leftSolenoidActive ? '#4CAF50' : '#f44336';
            leftToggleBtn.style.color = 'white';
            if (this.leftSolenoidActive && this.rightSolenoidActive) {
                this.rightSolenoidActive = false;
                rightToggleBtn.textContent = 'OFF';
                rightToggleBtn.style.backgroundColor = '#f44336';
            }
            this.updateFeedbackRodRotation();
            this.updateSolenoidVisuals();
        });
        rightCurrentSlider.addEventListener('input', (e) => {
            this.rightSolenoidCurrent = parseInt(e.target.value);
            rightValueSpan.textContent = this.rightSolenoidCurrent + '%';
            this.updateFeedbackRodRotation();
            this.updateSolenoidVisuals();
        });
        rightToggleBtn.addEventListener('click', () => {
            this.rightSolenoidActive = !this.rightSolenoidActive;
            rightToggleBtn.textContent = this.rightSolenoidActive ? 'ON' : 'OFF';
            rightToggleBtn.style.backgroundColor = this.rightSolenoidActive ? '#4CAF50' : '#f44336';
            rightToggleBtn.style.color = 'white';
            if (this.rightSolenoidActive && this.leftSolenoidActive) {
                this.leftSolenoidActive = false;
                leftToggleBtn.textContent = 'OFF';
                leftToggleBtn.style.backgroundColor = '#f44336';
            }
            this.updateFeedbackRodRotation();
            this.updateSolenoidVisuals();
        });
        speedSlider.addEventListener('input', (e) => {
            this.rotationSmoothing = parseFloat(e.target.value);
            speedValue.textContent = this.rotationSmoothing.toFixed(2);
        });
    }

    updateFeedbackRodRotation() {
        let targetRotation = 0;
        let targetLandPosition = 0;
        if (this.leftSolenoidActive) {
            const intensity = this.leftSolenoidCurrent / 100;
            targetRotation = -intensity * this.maxRotationAngle;
            targetLandPosition = -intensity * this.maxLandMovement; // Now moves LEFT!
        } else if (this.rightSolenoidActive) {
            const intensity = this.rightSolenoidCurrent / 100;
            targetRotation = intensity * this.maxRotationAngle;
            targetLandPosition = intensity * this.maxLandMovement; // Now moves RIGHT!
        }
        this.targetFeedbackRodRotation = targetRotation;
        this.targetLandAssemblyPosition = targetLandPosition;

        const rotationDisplay = document.getElementById('feedbackRotationDisplay');
        if (rotationDisplay) {
            const degrees = (targetRotation * 180 / Math.PI).toFixed(1);
            rotationDisplay.textContent = degrees + '°';
        }
        const landPositionDisplay = document.getElementById('landPositionDisplay');
        if (landPositionDisplay)
            landPositionDisplay.textContent = targetLandPosition.toFixed(2);
    }

    updateSolenoidVisuals() {
        if (this.solenoidMaterials.left) {
            if (this.leftSolenoidActive) {
                const intensity = this.leftSolenoidCurrent / 100;
                this.solenoidMaterials.left.color.setRGB(1, 1 - intensity, 1 - intensity);
                this.solenoidMaterials.left.emissive.setRGB(intensity * 0.3, 0, 0);
            } else {
                this.solenoidMaterials.left.color.setRGB(0.5, 0.5, 0.5);
                this.solenoidMaterials.left.emissive.setRGB(0, 0, 0);
            }
        }
        if (this.solenoidMaterials.right) {
            if (this.rightSolenoidActive) {
                const intensity = this.rightSolenoidCurrent / 100;
                this.solenoidMaterials.right.color.setRGB(1 - intensity, 1 - intensity, 1);
                this.solenoidMaterials.right.emissive.setRGB(0, 0, intensity * 0.3);
            } else {
                this.solenoidMaterials.right.color.setRGB(0.5, 0.5, 0.5);
                this.solenoidMaterials.right.emissive.setRGB(0, 0, 0);
            }
        }
    }

    animateFeedbackRod() {
        if (!this.modelLoaded || !this.components.Feedback_rod_001 || !this.initialFeedbackRodRotation)
            return;
        const rotationDiff = this.targetFeedbackRodRotation - this.feedbackRodRotation;
        this.feedbackRodRotation += rotationDiff * this.rotationSmoothing;
        this.components.Feedback_rod_001.rotation.z = this.initialFeedbackRodRotation.z + this.feedbackRodRotation;
    }

    animateLandAssembly() {
        if (!this.modelLoaded)
            return;
        const positionDiff = this.targetLandAssemblyPosition - this.landAssemblyPosition;
        this.landAssemblyPosition += positionDiff * this.landMovementSmoothing;
        if (this.components.Left_Land && this.initialLeftLandPosition)
            this.components.Left_Land.position.x = this.initialLeftLandPosition.x + this.landAssemblyPosition;
        if (this.components.Right_Land && this.initialRightLandPosition)
            this.components.Right_Land.position.x = this.initialRightLandPosition.x + this.landAssemblyPosition;
        if (this.components.Land_rod && this.initialLandRodPosition)
            this.components.Land_rod.position.x = this.initialLandRodPosition.x + this.landAssemblyPosition;
    }

    setupFuelTankControl() {
        const tank = this.components.Fuel_Tank;
        if (!tank) return;
        const box = new THREE.Box3().setFromObject(tank);
        const tankSize = box.getSize(new THREE.Vector3());
        const tankMin = box.min;
        const tankCenter = box.getCenter(new THREE.Vector3());
        const fuelWidth = tankSize.x * 0.96;
        const fuelHeight = tankSize.y * 0.98;
        const fuelDepth = tankSize.z * 0.96;
        const fuelGeometry = new THREE.BoxGeometry(fuelWidth, fuelHeight, fuelDepth);
        fuelGeometry.translate(0, fuelHeight / 2, 0);
        const fuelMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x33bbff, transparent: true, opacity: 0.4, transmission: 0.95,
            roughness: 0.05, thickness: 0.5, reflectivity: 0.7, ior: 1.33, clearcoat: 1.0, clearcoatRoughness: 0.05
        });
        this.fuelMesh = new THREE.Mesh(fuelGeometry, fuelMaterial);
        this.fuelMesh.position.set(tankCenter.x, tankMin.y, tankCenter.z);
        this.scene.add(this.fuelMesh);

        this._tankMinY = tankMin.y;
        this._tankHeight = tankSize.y;

        const fuelSlider = document.getElementById('fuelQuantitySlider');
        const fuelValueText = document.getElementById('fuelQuantityValue');
        const initialQuantity = parseInt(fuelSlider.value) || 0;
        this.updateFuelLevel(initialQuantity);
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
            const fuelFlow = (throttleValue / 100) * 50;
            fuelFlowDisplay.textContent = fuelFlow.toFixed(1) + ' L/min';
            if (this.fuelFlowSystem)
                this.fuelFlowSystem.setFlowSpeed(throttleValue / 100 * 0.002);
            if (throttleValue > 0 && this.fuelFlowSystem && !this.fuelFlowSystem.isFlowing) {
                const fuelSlider = document.getElementById('fuelQuantitySlider');
                const fuelQuantity = parseInt(fuelSlider.value) || 0;
                if (fuelQuantity > 0)
                    this.fuelFlowSystem.startFlow(throttleValue);
            } else if (throttleValue === 0 && this.fuelFlowSystem) {
                this.fuelFlowSystem.stopFlow();
            }
        });
    }

    updateFuelLevel(quantity) {
        const tank = this.components.Fuel_Tank;
        if (tank && tank.material) {
            tank.material.transparent = quantity >= 30;
            tank.material.opacity = quantity >= 30 ? 0.3 : 1.0;
            tank.material.needsUpdate = true;
        }
        const fuelLevel = Math.max(quantity / 100, 0.01);
        this.fuelMesh.scale.y = fuelLevel;
    }

    onWindowResize() {
        const canvasContainer = document.getElementById('canvas-container');
        this.camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    }

    animate() {
        this.controls.update();
        if (this.modelLoaded) {
            this.animateFeedbackRod();
            this.animateLandAssembly();
        }
        if (this.fuelFlowSystem)
            this.fuelFlowSystem.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}

// Start simulation
window.addEventListener('DOMContentLoaded', () => {
    new FADECSimulation();
});