import * as THREE from 'three';

export class FuelFlowSystem {
    constructor(scene, components, fuelMesh) {
        this.scene = scene;
        this.components = components;
        this.tankFuelMesh = fuelMesh;
        this.isFlowing = false;
        this.flowSpeed = 0.001;
        this.liquidMeshes = new Map();
        this.flowAnimations = [];
        
        this.initializePipes();
    }
    
    initializePipes() {
        this.createTankStyleLiquidMesh('Fuel_supply_pipe', -0.135, 0);
        this.createTankStyleLiquidMesh('Below_Mid_pipe', 0, 0);
        this.createTankStyleLiquidMesh('Left_pipe', 0, -0.245);
        this.createTankStyleLiquidMesh('Right_pipe', 0, 0.245);
    }
    
    createTankStyleLiquidMesh(pipeName, zOffset = 0, xOffset = 0) {
        const pipe = this.components[pipeName];
        if (!pipe) {
            console.error(`Pipe ${pipeName} not found`);
            return;
        }

        const box = new THREE.Box3().setFromObject(pipe);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const pipeScale = pipe.scale;

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

        let verticalGeometry, horizontalGeometry;
        let radius, height;

        if (pipeName === 'Fuel_supply_pipe') {
            radius = Math.min(size.x, size.z) * 0.35;
            height = size.y * 0.95 - 0.02; // Shorten by 0.02

            // Vertical section
            const verticalPoints = [
                new THREE.Vector3(0, height / 2, 0), // Top
                new THREE.Vector3(0, -height / 2, 0), // Bottom
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);

            // Horizontal section (+Z turn)
            const horizontalPoints = [
                new THREE.Vector3(0, -height / 2, 0), // Start at bottom
                new THREE.Vector3(0, -height / 2, radius * 3), // Extend to +Z
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);
            this._supplyPipeRadius = radius; // Store radius
        } else if (pipeName === 'Below_Mid_pipe') {
            // Horizontal along X-axis for bidirectional flow
            radius = Math.min(size.y, size.z) * 0.35;
            height = size.x * 0.95 + 0.1; // Extend by 0.1
            const curvePoints = [
                new THREE.Vector3(-height / 2 - 0.05, 0, 0), // Left end
                new THREE.Vector3(0, 0, 0), // Middle
                new THREE.Vector3(height / 2 + 0.025, 0, 0), // Right end
            ];
            const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(curve, 32, radius, 16, false); // Use as vertical for consistency
        } else if (pipeName === 'Left_pipe') {
            // Vertical pipe turning right (+X) at top
            radius = Math.min(size.x, size.z) * 0.35 / 3; // 3x smaller radius
            height = size.y * 0.95 * 0.75 + 0.02; // Adjusted height
            // Vertical section
            const verticalPoints = [
                new THREE.Vector3(0, -height / 2, 0), // Bottom
                new THREE.Vector3(0, height / 2, 0), // Top
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);
            // Horizontal section (+X turn)
            const horizontalPoints = [
                new THREE.Vector3(0, height / 2, 0), // Start at top
                new THREE.Vector3(radius * 32, height / 2, 0), // Extend to +X
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);
            this._leftPipeRadius = radius; // Store radius
        } else if (pipeName === 'Right_pipe') {
            // Vertical pipe turning left (-X) at top
            radius = Math.min(size.x, size.z) * 0.35 / 3; // 3x smaller radius
            height = size.y * 0.95 * 0.75 + 0.02; // Adjusted height
            // Vertical section
            const verticalPoints = [
                new THREE.Vector3(0, -height / 2, 0), // Bottom
                new THREE.Vector3(0, height / 2, 0), // Top
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);
            // Horizontal section (-X turn)
            const horizontalPoints = [
                new THREE.Vector3(0, height / 2, 0), // Start at top
                new THREE.Vector3(-radius * 31, height / 2, 0), // Extend to -X
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);
            this._rightPipeRadius = radius; // Store radius
        } else {
            radius = Math.min(size.y, size.z) * 0.35;
            height = size.x * 0.95;
            verticalGeometry = new THREE.CylinderGeometry(radius, radius, height, 16);
            verticalGeometry.rotateZ(Math.PI / 2);
        }

        // Create vertical mesh (and horizontal if applicable)
        const verticalMesh = new THREE.Mesh(verticalGeometry, fuelMaterial);
        const yOffset = pipeName === 'Fuel_supply_pipe' ? 0.025 : (pipeName === 'Left_pipe' || pipeName === 'Right_pipe' ? -0.05 : 0);
        verticalMesh.position.set(center.x + xOffset, center.y + yOffset, center.z + zOffset);
        verticalMesh.scale.copy(pipeScale);
        verticalMesh.scale.y = 0.01;
        verticalMesh.visible = false;
        this.scene.add(verticalMesh);
        verticalMesh.castShadow = false;
        verticalMesh.receiveShadow = false;
        this.liquidMeshes.set(`${pipeName}_vertical`, verticalMesh);

        if (pipeName === 'Fuel_supply_pipe' || pipeName === 'Left_pipe' || pipeName === 'Right_pipe') {
            const horizontalMesh = new THREE.Mesh(horizontalGeometry, fuelMaterial);
            horizontalMesh.position.set(center.x + xOffset, center.y + yOffset, center.z + zOffset);
            horizontalMesh.scale.copy(pipeScale);
            horizontalMesh.visible = false;
            this.scene.add(horizontalMesh);
            horizontalMesh.castShadow = false;
            horizontalMesh.receiveShadow = false;
            this.liquidMeshes.set(`${pipeName}_horizontal`, horizontalMesh);
        }

        console.log(`Created fuel mesh for ${pipeName}:`, {
            pipeCenter: center,
            xOffset: xOffset,
            yOffset: yOffset,
            zOffset: zOffset,
            verticalPosition: verticalMesh.position,
            radius: radius
        });

        if (pipeName === 'Fuel_supply_pipe') {
            this._supplyPipeHeight = height;
            this._supplyPipeTopY = center.y + yOffset + height / 2;
            this._supplyPipeBottomY = center.y + yOffset - height / 2;
        } else if (pipeName === 'Below_Mid_pipe') {
            this._belowMidPipeLength = height;
            this._belowMidPipeCenterX = center.x + xOffset;
            this._belowMidPipeCenterY = center.y + yOffset;
        } else if (pipeName === 'Left_pipe') {
            this._leftPipeHeight = height;
            this._leftPipeBottomY = center.y + yOffset - height / 2;
            this._leftPipeTopY = center.y + yOffset + height / 2;
        } else if (pipeName === 'Right_pipe') {
            this._rightPipeHeight = height;
            this._rightPipeBottomY = center.y + yOffset - height / 2;
            this._rightPipeTopY = center.y + yOffset + height / 2;
        }
    }

    startFlow(throttleValue) {
        if (this.isFlowing) return;
        
        if (!this.tankFuelMesh || this.tankFuelMesh.scale.y <= 0.01) {
            console.log("Cannot start flow - no fuel in tank");
            return;
        }
        
        console.log("Starting fuel flow from tank to fuel supply pipe to below mid pipe to left and right pipes");
        this.isFlowing = true;
        this.makePipeTransparent('Fuel_supply_pipe');
        this.makePipeTransparent('Below_Mid_pipe');
        this.makePipeTransparent('Left_pipe');
        this.makePipeTransparent('Right_pipe');
        this.makePipeTransparent('Top_Casing');
        this.makePipeTransparent('Bottom_Casing');
        
        this.animateTankToSupplyPipe();
    }
    
    stopFlow() {
        console.log("Stopping fuel flow");
        this.isFlowing = false;
        
        this.flowAnimations.forEach(animation => {
            if (typeof animation === 'number') {
                clearTimeout(animation);
            }
        });
        this.flowAnimations = [];
        
        const supplyVerticalMesh = this.liquidMeshes.get('Fuel_supply_pipe_vertical');
        const supplyHorizontalMesh = this.liquidMeshes.get('Fuel_supply_pipe_horizontal');
        if (supplyVerticalMesh) {
            supplyVerticalMesh.visible = false;
            supplyVerticalMesh.scale.y = 0.01;
            supplyVerticalMesh.position.y = this._supplyPipeTopY;
        }
        if (supplyHorizontalMesh) {
            supplyHorizontalMesh.visible = false;
            supplyHorizontalMesh.scale.y = 1;
            supplyHorizontalMesh.material.clippingPlanes = [];
        }
        
        const belowMidMesh = this.liquidMeshes.get('Below_Mid_pipe_vertical');
        if (belowMidMesh) {
            belowMidMesh.visible = false;
            belowMidMesh.scale.y = 0.01;
        }
        
        const leftVerticalMesh = this.liquidMeshes.get('Left_pipe_vertical');
        const leftHorizontalMesh = this.liquidMeshes.get('Left_pipe_horizontal');
        if (leftVerticalMesh) {
            leftVerticalMesh.visible = false;
            leftVerticalMesh.scale.y = 0.01;
            leftVerticalMesh.position.y = this._leftPipeBottomY;
        }
        if (leftHorizontalMesh) {
            leftHorizontalMesh.visible = false;
            leftHorizontalMesh.scale.y = 1;
            leftHorizontalMesh.material.clippingPlanes = [];
        }
        
        const rightVerticalMesh = this.liquidMeshes.get('Right_pipe_vertical');
        const rightHorizontalMesh = this.liquidMeshes.get('Right_pipe_horizontal');
        if (rightVerticalMesh) {
            rightVerticalMesh.visible = false;
            rightVerticalMesh.scale.y = 0.01;
            rightVerticalMesh.position.y = this._rightPipeBottomY;
        }
        if (rightHorizontalMesh) {
            rightHorizontalMesh.visible = false;
            rightHorizontalMesh.scale.y = 1;
            rightHorizontalMesh.material.clippingPlanes = [];
        }
        
        this.resetPipeTransparency('Fuel_supply_pipe');
        this.resetPipeTransparency('Below_Mid_pipe');
        this.resetPipeTransparency('Left_pipe');
        this.resetPipeTransparency('Right_pipe');
        this.resetPipeTransparency('Top_Casing');
        this.resetPipeTransparency('Bottom_Casing');
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
        const supplyVerticalMesh = this.liquidMeshes.get('Fuel_supply_pipe_vertical');
        const supplyHorizontalMesh = this.liquidMeshes.get('Fuel_supply_pipe_horizontal');
        const belowMidMesh = this.liquidMeshes.get('Below_Mid_pipe_vertical');
        const leftVerticalMesh = this.liquidMeshes.get('Left_pipe_vertical');
        const leftHorizontalMesh = this.liquidMeshes.get('Left_pipe_horizontal');
        const rightVerticalMesh = this.liquidMeshes.get('Right_pipe_vertical');
        const rightHorizontalMesh = this.liquidMeshes.get('Right_pipe_horizontal');
        
        if (!supplyVerticalMesh || !supplyHorizontalMesh || !belowMidMesh || !leftVerticalMesh || !leftHorizontalMesh || !rightVerticalMesh || !rightHorizontalMesh) {
            console.error('Required liquid meshes not found');
            return;
        }
        
        supplyVerticalMesh.visible = false;
        supplyVerticalMesh.scale.y = 0.01;
        supplyVerticalMesh.position.y = this._supplyPipeTopY;
        supplyHorizontalMesh.visible = false;
        supplyHorizontalMesh.scale.y = 1;
        belowMidMesh.scale.y = 0.01;
        belowMidMesh.visible = false;
        leftVerticalMesh.scale.y = 0.01;
        leftVerticalMesh.visible = false;
        leftVerticalMesh.position.y = this._leftPipeBottomY;
        leftHorizontalMesh.scale.y = 1;
        leftHorizontalMesh.visible = false;
        rightVerticalMesh.scale.y = 0.01;
        rightVerticalMesh.visible = false;
        rightVerticalMesh.position.y = this._rightPipeBottomY;
        rightHorizontalMesh.scale.y = 1;
        rightHorizontalMesh.visible = false;
        
        const startTime = Date.now();
        const durationSupply = 2000; // Fuel_supply_pipe
        const durationSupplyHorizontal = 500; // Horizontal turn
        const durationBelowMid = 1000; // Below_Mid_pipe
        const durationLeftRight = 1000; // Left_pipe and Right_pipe
        const durationLeftRightHorizontal = 500; // Horizontal turns

        const animate = () => {
            if (!this.isFlowing) return;
            const elapsed = Date.now() - startTime;
            
            // Animate Fuel_supply_pipe (top to bottom, then +Z turn)
            if (elapsed <= durationSupply) {
                supplyVerticalMesh.visible = true;
                const progress = Math.min(elapsed / durationSupply, 1);
                const fuelLevel = Math.max(progress, 0.01);
                supplyVerticalMesh.scale.y = fuelLevel;
                supplyVerticalMesh.position.y = this._supplyPipeTopY - (this._supplyPipeHeight * fuelLevel) / 2;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.visible = true;
                const horizontalProgress = Math.min((elapsed - durationSupply) / durationSupplyHorizontal, 1);
                supplyHorizontalMesh.scale.y = Math.max(horizontalProgress, 0.01);
            }
            
            // Animate Below_Mid_pipe (bidirectional)
            if (elapsed > durationSupply + durationSupplyHorizontal && elapsed <= durationSupply + durationSupplyHorizontal + durationBelowMid) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                belowMidMesh.visible = true;
                const belowMidProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal) / durationBelowMid, 1);
                const belowMidLevel = Math.max(belowMidProgress, 0.01);
                belowMidMesh.scale.y = belowMidLevel;
            }
            
            // Animate Left_pipe and Right_pipe (bottom to top, then turns)
            if (elapsed > durationSupply + durationSupplyHorizontal + durationBelowMid && elapsed <= durationSupply + durationSupplyHorizontal + durationBelowMid + durationLeftRight) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                belowMidMesh.visible = true;
                belowMidMesh.scale.y = 1;
                leftVerticalMesh.visible = true;
                rightVerticalMesh.visible = true;
                const leftRightProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationBelowMid) / durationLeftRight, 1);
                const leftRightLevel = Math.max(leftRightProgress, 0.01);
                leftVerticalMesh.scale.y = leftRightLevel;
                leftVerticalMesh.position.y = this._leftPipeBottomY + (this._leftPipeHeight * leftRightLevel) / 2;
                rightVerticalMesh.scale.y = leftRightLevel;
                rightVerticalMesh.position.y = this._rightPipeBottomY + (this._rightPipeHeight * leftRightLevel) / 2;
            } else if (elapsed > durationSupply + durationSupplyHorizontal + durationBelowMid && elapsed <= durationSupply + durationSupplyHorizontal + durationBelowMid + durationLeftRight + durationLeftRightHorizontal) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                belowMidMesh.visible = true;
                belowMidMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                const horizontalProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationBelowMid - durationLeftRight) / durationLeftRightHorizontal, 1);
                // Clip Left_pipe horizontal (+X) from x=0 to x=radius*32
                const leftClipX = this._leftPipeRadius * 32 * horizontalProgress;
                const leftPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), leftClipX + (this._leftPipeBottomY + this._leftPipeHeight / 2 + this._leftPipeRadius * 32));
                leftHorizontalMesh.material.clippingPlanes = [leftPlane];
                leftHorizontalMesh.material.needsUpdate = true;
                // Clip Right_pipe horizontal (-X) from x=0 to x=-radius*31
                const rightClipX = -this._rightPipeRadius * 31 * horizontalProgress;
                const rightPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), rightClipX - (this._rightPipeBottomY + this._rightPipeHeight / 2 - this._rightPipeRadius * 31));
                rightHorizontalMesh.material.clippingPlanes = [rightPlane];
                rightHorizontalMesh.material.needsUpdate = true;
            }
            
            if (elapsed < durationSupply + durationSupplyHorizontal + durationBelowMid + durationLeftRight + durationLeftRightHorizontal) {
                requestAnimationFrame(animate);
            } else {
                // Ensure clipping planes are cleared at the end
                leftHorizontalMesh.material.clippingPlanes = [];
                leftHorizontalMesh.material.needsUpdate = true;
                rightHorizontalMesh.material.clippingPlanes = [];
                rightHorizontalMesh.material.needsUpdate = true;
            }
        };
        animate();
    }

    setFlowSpeed(speed) {
        this.flowSpeed = speed;
    }
    
    update() {
        if (!this.isFlowing) return;
        
        const meshes = [
            this.liquidMeshes.get('Fuel_supply_pipe_vertical'),
            this.liquidMeshes.get('Fuel_supply_pipe_horizontal'),
            this.liquidMeshes.get('Below_Mid_pipe_vertical'),
            this.liquidMeshes.get('Left_pipe_vertical'),
            this.liquidMeshes.get('Left_pipe_horizontal'),
            this.liquidMeshes.get('Right_pipe_vertical'),
            this.liquidMeshes.get('Right_pipe_horizontal')
        ];
        
        meshes.forEach(mesh => {
            if (mesh && mesh.visible) {
                const t = Date.now() * 0.001;
                mesh.material.opacity = 0.4 + 0.1 * Math.sin(t * 2);
            }
        });
    }
}