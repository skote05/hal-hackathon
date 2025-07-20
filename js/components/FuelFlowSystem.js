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
        this.createTankStyleLiquidMesh('Mid_Pipe', 0, 0);
        this.createTankStyleLiquidMesh('Spool_Pipe', 0, 0);
        this.createTankStyleLiquidMesh('Left_pipe', 0, -0.245);
        this.createTankStyleLiquidMesh('Right_pipe', 0, 0.245);
        this.createTankStyleLiquidMesh('Left_Output', 0, -0.245);
        this.createTankStyleLiquidMesh('Right_Output', 0, 0.245);
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

        let verticalGeometry, horizontalGeometry, secondVerticalGeometry;
        let radius, height, secondHeight;

        if (pipeName === 'Fuel_supply_pipe') {
            radius = Math.min(size.x, size.z) * 0.35;
            height = size.y * 0.95 - 0.02;

            const verticalPoints = [
                new THREE.Vector3(0, height / 2, 0),
                new THREE.Vector3(0, -height / 2, 0),
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);

            const horizontalPoints = [
                new THREE.Vector3(0, -height / 2, 0),
                new THREE.Vector3(0, -height / 2, radius * 3),
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);
            this._supplyPipeRadius = radius;
        } else if (pipeName === 'Mid_Pipe') {
            radius = Math.min(size.x, size.z) * 0.35;
            height = size.y * 0.95;

            const verticalPoints = [
                new THREE.Vector3(0, height / 2, 0),
                new THREE.Vector3(0, -height / 2, 0),
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);
            this._midPipeRadius = radius;
            this._midPipeHeight = height;
        } else if (pipeName === 'Spool_Pipe') {
            radius = Math.min(size.y, size.z) * 0.35;
            height = size.x * 0.95;
            const curvePoints = [
                new THREE.Vector3(-height / 2, 0, 0),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(height / 2, 0, 0),
            ];
            const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(curve, 32, radius, 16, false);
            this._spoolPipeLength = height;
        } else if (pipeName === 'Left_pipe') {
            radius = Math.min(size.x, size.z) * 0.35 / 3;
            height = size.y * 0.95 * 0.75 + 0.02;
            secondHeight = (height * 0.5) / 2;

            const verticalPoints = [
                new THREE.Vector3(0, -height / 2, 0),
                new THREE.Vector3(0, height / 2, 0),
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);

            const horizontalPoints = [
                new THREE.Vector3(0, height / 2, 0),
                new THREE.Vector3(radius * 32, height / 2, 0),
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);

            const secondVerticalPoints = [
                new THREE.Vector3(radius * 32, 0, 0),
                new THREE.Vector3(radius * 32, secondHeight, 0),
            ];
            const secondVerticalCurve = new THREE.CatmullRomCurve3(secondVerticalPoints, false, 'catmullrom', 0);
            secondVerticalGeometry = new THREE.TubeGeometry(secondVerticalCurve, 16, radius, 16, false);
            this._leftPipeRadius = radius;
            this._leftPipeHeight = height;
            this._leftPipeSecondHeight = secondHeight;
        } else if (pipeName === 'Right_pipe') {
            radius = Math.min(size.x, size.z) * 0.35 / 3;
            height = size.y * 0.95 * 0.75 + 0.02;
            secondHeight = (height * 0.5) / 2;

            const verticalPoints = [
                new THREE.Vector3(0, -height / 2, 0),
                new THREE.Vector3(0, height / 2, 0),
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);

            const horizontalPoints = [
                new THREE.Vector3(0, height / 2, 0),
                new THREE.Vector3(-radius * 31, height / 2, 0),
            ];
            const horizontalCurve = new THREE.CatmullRomCurve3(horizontalPoints, false, 'catmullrom', 0);
            horizontalGeometry = new THREE.TubeGeometry(horizontalCurve, 16, radius, 16, false);

            const secondVerticalPoints = [
                new THREE.Vector3(-radius * 31, 0, 0),
                new THREE.Vector3(-radius * 31, secondHeight, 0),
            ];
            const secondVerticalCurve = new THREE.CatmullRomCurve3(secondVerticalPoints, false, 'catmullrom', 0);
            secondVerticalGeometry = new THREE.TubeGeometry(secondVerticalCurve, 16, radius, 16, false);
            this._rightPipeRadius = radius;
            this._rightPipeHeight = height;
            this._rightPipeSecondHeight = secondHeight;
        } else if (pipeName === 'Left_Output' || pipeName === 'Right_Output') {
            radius = Math.min(size.x, size.z) * 0.35 / 3;
            height = size.y * 0.95;

            const verticalPoints = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, height, 0),
            ];
            const verticalCurve = new THREE.CatmullRomCurve3(verticalPoints, false, 'catmullrom', 0);
            verticalGeometry = new THREE.TubeGeometry(verticalCurve, 16, radius, 16, false);
            this[`_${pipeName.toLowerCase()}Radius`] = radius;
            this[`_${pipeName.toLowerCase()}Height`] = height;
        } else {
            radius = Math.min(size.y, size.z) * 0.35;
            height = size.x * 0.95;
            verticalGeometry = new THREE.CylinderGeometry(radius, radius, height, 16);
            verticalGeometry.rotateZ(Math.PI / 2);
        }

        const verticalMesh = new THREE.Mesh(verticalGeometry, fuelMaterial);
        const yOffset = pipeName === 'Fuel_supply_pipe' ? 0.025 : (pipeName === 'Left_pipe' || pipeName === 'Right_pipe' ? -0.05 : 0);
        verticalMesh.position.set(center.x + xOffset, center.y + yOffset, center.z + zOffset);
        verticalMesh.scale.copy(pipeScale);
        verticalMesh.scale.y = pipeName === 'Spool_Pipe' ? 1 : 0.01;
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

            if (pipeName === 'Left_pipe' || pipeName === 'Right_pipe') {
                const secondVerticalMesh = new THREE.Mesh(secondVerticalGeometry, fuelMaterial);
                secondVerticalMesh.position.set(center.x + xOffset, center.y + yOffset + height / 2, center.z + zOffset);
                secondVerticalMesh.scale.copy(pipeScale);
                secondVerticalMesh.visible = false;
                this.scene.add(secondVerticalMesh);
                secondVerticalMesh.castShadow = false;
                secondVerticalMesh.receiveShadow = false;
                this.liquidMeshes.set(`${pipeName}_second_vertical`, secondVerticalMesh);
            }
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
        } else if (pipeName === 'Mid_Pipe') {
            this._midPipeHeight = height;
            this._midPipeTopY = center.y + yOffset + height / 2;
            this._midPipeMiddleY = center.y + yOffset;
            this._midPipeBottomY = center.y + yOffset - height / 2;
        } else if (pipeName === 'Spool_Pipe') {
            this._spoolPipeLength = height;
            this._spoolPipeCenterX = center.x + xOffset;
            this._spoolPipeCenterY = center.y + yOffset;
        } else if (pipeName === 'Left_pipe') {
            this._leftPipeHeight = height;
            this._leftPipeBottomY = center.y + yOffset - height / 2;
            this._leftPipeTopY = center.y + yOffset + height / 2;
            this._leftPipeSecondTopY = center.y + yOffset + height / 2 + secondHeight;
        } else if (pipeName === 'Right_pipe') {
            this._rightPipeHeight = height;
            this._rightPipeBottomY = center.y + yOffset - height / 2;
            this._rightPipeTopY = center.y + yOffset + height / 2;
            this._rightPipeSecondTopY = center.y + yOffset + height / 2 + secondHeight;
        } else if (pipeName === 'Left_Output') {
            this._leftOutputTopY = center.y + yOffset + height;
            this._leftOutputBottomY = center.y + yOffset;
        } else if (pipeName === 'Right_Output') {
            this._rightOutputTopY = center.y + yOffset + height;
            this._rightOutputBottomY = center.y + yOffset;
        }
    }

    startFlow(throttleValue) {
        if (this.isFlowing) return;
        
        if (!this.tankFuelMesh || this.tankFuelMesh.scale.y <= 0.01) {
            console.log("Cannot start flow - no fuel in tank");
            return;
        }
        
        console.log("Starting fuel flow from tank to fuel supply pipe to left and right pipes to mid pipe to spool pipe to left and right outputs");
        this.isFlowing = true;
        this.makePipeTransparent('Fuel_supply_pipe');
        this.makePipeTransparent('Left_pipe');
        this.makePipeTransparent('Right_pipe');
        this.makePipeTransparent('Mid_Pipe');
        this.makePipeTransparent('Spool_Pipe');
        this.makePipeTransparent('Left_Output');
        this.makePipeTransparent('Right_Output');
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
        
        const meshes = [
            'Fuel_supply_pipe_vertical',
            'Fuel_supply_pipe_horizontal',
            'Left_pipe_vertical',
            'Left_pipe_horizontal',
            'Left_pipe_second_vertical',
            'Right_pipe_vertical',
            'Right_pipe_horizontal',
            'Right_pipe_second_vertical',
            'Mid_Pipe_vertical',
            'Spool_Pipe_vertical',
            'Left_Output_vertical',
            'Right_Output_vertical'
        ];
        
        meshes.forEach(key => {
            const mesh = this.liquidMeshes.get(key);
            if (mesh) {
                mesh.visible = false;
                mesh.scale.y = key.includes('horizontal') || key === 'Spool_Pipe_vertical' ? 1 : 0.01;
                if (key === 'Left_pipe_vertical') mesh.position.y = this._leftPipeBottomY;
                if (key === 'Right_pipe_vertical') mesh.position.y = this._rightPipeBottomY;
                if (key === 'Left_pipe_second_vertical') mesh.position.y = this._leftPipeTopY;
                if (key === 'Right_pipe_second_vertical') mesh.position.y = this._rightPipeTopY;
                if (key === 'Fuel_supply_pipe_vertical') mesh.position.y = this._supplyPipeTopY;
                if (key === 'Mid_Pipe_vertical') mesh.position.y = this._midPipeTopY;
                if (key === 'Left_Output_vertical') mesh.position.y = this._leftOutputBottomY;
                if (key === 'Right_Output_vertical') mesh.position.y = this._rightOutputBottomY;
                if (key.includes('horizontal')) {
                    mesh.material.clippingPlanes = [];
                    mesh.material.needsUpdate = true;
                }
            }
        });
        
        this.resetPipeTransparency('Fuel_supply_pipe');
        this.resetPipeTransparency('Left_pipe');
        this.resetPipeTransparency('Right_pipe');
        this.resetPipeTransparency('Mid_Pipe');
        this.resetPipeTransparency('Spool_Pipe');
        this.resetPipeTransparency('Left_Output');
        this.resetPipeTransparency('Right_Output');
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
        const leftVerticalMesh = this.liquidMeshes.get('Left_pipe_vertical');
        const leftHorizontalMesh = this.liquidMeshes.get('Left_pipe_horizontal');
        const leftSecondVerticalMesh = this.liquidMeshes.get('Left_pipe_second_vertical');
        const rightVerticalMesh = this.liquidMeshes.get('Right_pipe_vertical');
        const rightHorizontalMesh = this.liquidMeshes.get('Right_pipe_horizontal');
        const rightSecondVerticalMesh = this.liquidMeshes.get('Right_pipe_second_vertical');
        const midPipeMesh = this.liquidMeshes.get('Mid_Pipe_vertical');
        const spoolPipeMesh = this.liquidMeshes.get('Spool_Pipe_vertical');
        const leftOutputMesh = this.liquidMeshes.get('Left_Output_vertical');
        const rightOutputMesh = this.liquidMeshes.get('Right_Output_vertical');
        
        const meshesNotFound = !supplyVerticalMesh || !supplyHorizontalMesh || !leftVerticalMesh ||
            !leftHorizontalMesh || !leftSecondVerticalMesh || !rightVerticalMesh ||
            !rightHorizontalMesh || !rightSecondVerticalMesh || !midPipeMesh ||
            !spoolPipeMesh || !leftOutputMesh || !rightOutputMesh;
        
        if (meshesNotFound) {
            console.error('Required liquid meshes not found');
            return;
        }
        
        supplyVerticalMesh.visible = false;
        supplyVerticalMesh.scale.y = 0.01;
        supplyVerticalMesh.position.y = this._supplyPipeTopY;
        supplyHorizontalMesh.visible = false;
        supplyHorizontalMesh.scale.y = 1;
        leftVerticalMesh.scale.y = 0.01;
        leftVerticalMesh.visible = false;
        leftVerticalMesh.position.y = this._leftPipeBottomY;
        leftHorizontalMesh.scale.y = 1;
        leftHorizontalMesh.visible = false;
        leftSecondVerticalMesh.scale.y = 0.01;
        leftSecondVerticalMesh.visible = false;
        leftSecondVerticalMesh.position.y = this._leftPipeTopY;
        rightVerticalMesh.scale.y = 0.01;
        rightVerticalMesh.visible = false;
        rightVerticalMesh.position.y = this._rightPipeBottomY;
        rightHorizontalMesh.scale.y = 1;
        rightHorizontalMesh.visible = false;
        rightSecondVerticalMesh.scale.y = 0.01;
        rightSecondVerticalMesh.visible = false;
        rightSecondVerticalMesh.position.y = this._rightPipeTopY;
        midPipeMesh.visible = false;
        midPipeMesh.scale.y = 0.01;
        midPipeMesh.position.y = this._midPipeTopY;
        spoolPipeMesh.visible = false;
        spoolPipeMesh.scale.y = 1;
        leftOutputMesh.visible = false;
        leftOutputMesh.scale.y = 0.01;
        leftOutputMesh.position.y = this._leftOutputBottomY;
        rightOutputMesh.visible = false;
        rightOutputMesh.scale.y = 0.01;
        rightOutputMesh.position.y = this._rightOutputBottomY;
        
        const startTime = Date.now();
        const durationSupply = 2000;
        const durationSupplyHorizontal = 500;
        const durationLeftRight = 1000;
        const durationLeftRightHorizontal = 500;
        const durationLeftRightSecondVertical = 500;
        const durationMidPipeTopToMiddle = 500;
        const durationMidPipeMiddleToBottom = 500;
        const durationSpoolPipe = 300;
        const durationOutputs = 1000;

        const animate = () => {
            if (!this.isFlowing) return;
            const elapsed = Date.now() - startTime;
            
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
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.visible = true;
                rightVerticalMesh.visible = true;
                const leftRightProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal) / durationLeftRight, 1);
                const leftRightLevel = Math.max(leftRightProgress, 0.01);
                leftVerticalMesh.scale.y = leftRightLevel;
                leftVerticalMesh.position.y = this._leftPipeBottomY + (this._leftPipeHeight * leftRightLevel) / 2;
                rightVerticalMesh.scale.y = leftRightLevel;
                rightVerticalMesh.position.y = this._rightPipeBottomY + (this._rightPipeHeight * leftRightLevel) / 2;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                const horizontalProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight) / durationLeftRightHorizontal, 1);
                const leftClipX = this._leftPipeRadius * 32 * horizontalProgress;
                const leftPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), leftClipX + (this._leftPipeBottomY + this._leftPipeHeight / 2 + this._leftPipeRadius * 32));
                leftHorizontalMesh.material.clippingPlanes = [leftPlane];
                leftHorizontalMesh.material.needsUpdate = true;
                const rightClipX = -this._rightPipeRadius * 31 * horizontalProgress;
                const rightPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), rightClipX - (this._rightPipeBottomY + this._rightPipeHeight / 2 - this._rightPipeRadius * 31));
                rightHorizontalMesh.material.clippingPlanes = [rightPlane];
                rightHorizontalMesh.material.needsUpdate = true;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                leftHorizontalMesh.material.clippingPlanes = [];
                rightHorizontalMesh.material.clippingPlanes = [];
                leftSecondVerticalMesh.visible = true;
                rightSecondVerticalMesh.visible = true;
                const secondVerticalProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight - durationLeftRightHorizontal) / durationLeftRightSecondVertical, 1);
                const secondVerticalLevel = Math.max(secondVerticalProgress, 0.01);
                leftSecondVerticalMesh.scale.y = secondVerticalLevel;
                rightSecondVerticalMesh.scale.y = secondVerticalLevel;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical + durationMidPipeTopToMiddle) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                leftSecondVerticalMesh.scale.y = 1;
                rightSecondVerticalMesh.scale.y = 1;
                midPipeMesh.visible = true;
                const midProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight - durationLeftRightHorizontal - durationLeftRightSecondVertical) / durationMidPipeTopToMiddle, 1);
                const midLevel = Math.max(midProgress, 0.01);
                midPipeMesh.scale.y = midLevel * 0.5;
                midPipeMesh.position.y = this._midPipeTopY - (this._midPipeHeight * midLevel * 0.5) / 2;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical + durationMidPipeTopToMiddle + durationMidPipeMiddleToBottom) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                leftSecondVerticalMesh.scale.y = 1;
                rightSecondVerticalMesh.scale.y = 1;
                midPipeMesh.visible = true;
                const midProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight - durationLeftRightHorizontal - durationLeftRightSecondVertical - durationMidPipeTopToMiddle) / durationMidPipeMiddleToBottom, 1);
                const midLevel = Math.max(midProgress, 0.01);
                midPipeMesh.scale.y = 0.5 + midLevel * 0.5;
                midPipeMesh.position.y = this._midPipeTopY - (this._midPipeHeight * (0.5 + midLevel * 0.5)) / 2;
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical + durationMidPipeTopToMiddle + durationMidPipeMiddleToBottom + durationSpoolPipe) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                leftSecondVerticalMesh.scale.y = 1;
                rightSecondVerticalMesh.scale.y = 1;
                midPipeMesh.scale.y = 1;
                midPipeMesh.position.y = this._midPipeTopY - this._midPipeHeight / 2;
                spoolPipeMesh.visible = true;
                const spoolProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight - durationLeftRightHorizontal - durationLeftRightSecondVertical - durationMidPipeTopToMiddle - durationMidPipeMiddleToBottom) / durationSpoolPipe, 1);
                spoolPipeMesh.scale.y = Math.max(spoolProgress, 0.01);
            } else if (elapsed <= durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical + durationMidPipeTopToMiddle + durationMidPipeMiddleToBottom + durationSpoolPipe + durationOutputs) {
                supplyVerticalMesh.scale.y = 1;
                supplyHorizontalMesh.scale.y = 1;
                leftVerticalMesh.scale.y = 1;
                rightVerticalMesh.scale.y = 1;
                leftHorizontalMesh.visible = true;
                rightHorizontalMesh.visible = true;
                leftSecondVerticalMesh.scale.y = 1;
                rightSecondVerticalMesh.scale.y = 1;
                midPipeMesh.scale.y = 1;
                midPipeMesh.position.y = this._midPipeTopY - this._midPipeHeight / 2;
                spoolPipeMesh.scale.y = 1;
                leftOutputMesh.visible = true;
                rightOutputMesh.visible = true;
                const outputProgress = Math.min((elapsed - durationSupply - durationSupplyHorizontal - durationLeftRight - durationLeftRightHorizontal - durationLeftRightSecondVertical - durationMidPipeTopToMiddle - durationMidPipeMiddleToBottom - durationSpoolPipe) / durationOutputs, 1);
                const outputLevel = Math.max(outputProgress, 0.01);
                leftOutputMesh.scale.y = outputLevel;
                leftOutputMesh.position.y = this._leftOutputBottomY + (this._leftOutputHeight * outputLevel) / 2;
                rightOutputMesh.scale.y = outputLevel;
                rightOutputMesh.position.y = this._rightOutputBottomY + (this._rightOutputHeight * outputLevel) / 2;
            }
            
            if (elapsed < durationSupply + durationSupplyHorizontal + durationLeftRight + durationLeftRightHorizontal + durationLeftRightSecondVertical + durationMidPipeTopToMiddle + durationMidPipeMiddleToBottom + durationSpoolPipe + durationOutputs) {
                requestAnimationFrame(animate);
            } else {
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
            'Fuel_supply_pipe_vertical',
            'Fuel_supply_pipe_horizontal',
            'Left_pipe_vertical',
            'Left_pipe_horizontal',
            'Left_pipe_second_vertical',
            'Right_pipe_vertical',
            'Right_pipe_horizontal',
            'Right_pipe_second_vertical',
            'Mid_Pipe_vertical',
            'Spool_Pipe_vertical',
            'Left_Output_vertical',
            'Right_Output_vertical'
        ].map(key => this.liquidMeshes.get(key));
        
        meshes.forEach(mesh => {
            if (mesh && mesh.visible) {
                const t = Date.now() * 0.001;
                mesh.material.opacity = 0.4 + 0.1 * Math.sin(t * 2);
            }
        });
    }
}