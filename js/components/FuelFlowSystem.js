// js/components/FuelFlowSystem.js
import * as THREE from 'three';

export class FuelFlowSystem {
    constructor(scene, components, fuelMesh) {
        this.scene = scene;
        this.components = components;
        this.tankFuelMesh = fuelMesh; // Reference to your working tank fuel mesh
        this.isFlowing = false;
        this.flowSpeed = 0.001;
        this.liquidMeshes = new Map();
        this.flowAnimations = [];
        
        // Only initialize the first pipe for now
        this.initializeFirstPipe();
    }
    
    initializeFirstPipe() {
        // Only create liquid mesh for fuel supply pipe initially
        this.createTankStyleLiquidMesh('Fuel_supply_pipe',-0.135);
    }
    
    // js/components/FuelFlowSystem.js - Updated createTankStyleLiquidMesh method
    createTankStyleLiquidMesh(pipeName, zOffset = 0) {
    const pipe = this.components[pipeName];
    if (!pipe) {
        console.error(`Pipe ${pipeName} not found`);
        return;
    }

    // Get pipe bounding box and center
    const box = new THREE.Box3().setFromObject(pipe);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const pipeScale = pipe.scale;

    // Fuel material
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

    // Pipe orientation
    const isVertical = size.y > size.x && size.y > size.z;
    const isHorizontal = size.x > size.y && size.x > size.z;

    let fuelGeometry;
    let radius, height;

    if (isVertical) {
        radius = Math.min(size.x, size.z) * 0.35;
    height = size.y * 0.95;
    fuelGeometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    // Anchor at the top edge, so scaling grows downward
    fuelGeometry.translate(0, height / 2, 0);

    } else if (isHorizontal) {
        radius = Math.min(size.y, size.z) * 0.35;
        height = size.x * 0.95;
        fuelGeometry = new THREE.CylinderGeometry(radius, radius, height, 16);
        fuelGeometry.rotateZ(Math.PI / 2);
    } else {
        radius = Math.min(size.x, size.z) * 0.35;
        height = size.y * 0.95;
        fuelGeometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    }

    const liquidMesh = new THREE.Mesh(fuelGeometry, fuelMaterial);
    const yOffset = 0.025; 
    // Add the Y-axis offset to the mesh position
    liquidMesh.position.set(center.x, center.y + yOffset, center.z + zOffset);

    // Use the same scale as the pipe
    liquidMesh.scale.copy(pipeScale);

    // Start with minimal height for animation
    liquidMesh.scale.y = 0.01;
    liquidMesh.visible = false;

    this.scene.add(liquidMesh);
    liquidMesh.castShadow = false;
    liquidMesh.receiveShadow = false;
    this.liquidMeshes.set(pipeName, liquidMesh);

    console.log(`Created fuel mesh for ${pipeName}:`, {
        pipeCenter: center,
        zOffset: zOffset,
        finalPosition: liquidMesh.position
    });
}


    startFlow(throttleValue) {
        if (this.isFlowing) return;
        
        // Check if there's fuel in tank
        if (!this.tankFuelMesh || this.tankFuelMesh.scale.y <= 0.01) {
            console.log("Cannot start flow - no fuel in tank");
            return;
        }
        
        console.log("Starting fuel flow from tank to fuel supply pipe");
        this.isFlowing = true;
        this.makePipeTransparent('Fuel_supply_pipe');
        
        // Start the flow animation
        this.animateTankToSupplyPipe();
    }
    
    stopFlow() {
        console.log("Stopping fuel flow");
        this.isFlowing = false;
        
        // Clear animations
        this.flowAnimations.forEach(animation => {
            if (typeof animation === 'number') {
                clearTimeout(animation);
            }
        });
        this.flowAnimations = [];
        
        // Hide liquid mesh
        const liquidMesh = this.liquidMeshes.get('Fuel_supply_pipe');
        if (liquidMesh) {
            liquidMesh.visible = false;
            liquidMesh.scale.y = 0.01;
        }
        
        // Reset pipe transparency
        this.resetPipeTransparency('Fuel_supply_pipe');
    }
    
    makePipeTransparent(pipeName) {
        const pipe = this.components[pipeName];
        if (pipe) {
            pipe.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 0.3;
                    child.material.needsUpdate = true;
                }
            });
        }
    }
    
    resetPipeTransparency(pipeName) {
        const pipe = this.components[pipeName];
        if (pipe) {
            pipe.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.transparent = false;
                    child.material.opacity = 1.0;
                    child.material.needsUpdate = true;
                }
            });
        }
    }
    
    animateTankToSupplyPipe() {
        const liquidMesh = this.liquidMeshes.get('Fuel_supply_pipe');
        if (!liquidMesh) {
            console.error('Fuel supply pipe liquid mesh not found');
            return;
        }
        liquidMesh.visible = true;
        liquidMesh.scale.y = 0.01;
        const startTime = Date.now();
        const duration = 2000; // 2 seconds for visual effect

        const animate = () => {
            if (!this.isFlowing) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const fuelLevel = Math.max(progress, 0.01);
            liquidMesh.scale.y = fuelLevel;
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    setFlowSpeed(speed) {
        this.flowSpeed = speed;
    }
    
    update() {
        if (!this.isFlowing) return;
        
        // Add subtle flow animation
        const liquidMesh = this.liquidMeshes.get('Fuel_supply_pipe');
        if (liquidMesh && liquidMesh.visible) {
            // Mild visual effect
            const t = Date.now() * 0.001;
            liquidMesh.material.opacity = 0.4 + 0.1 * Math.sin(t * 2);
        }
    }
}
