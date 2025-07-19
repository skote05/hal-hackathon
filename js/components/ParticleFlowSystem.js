// js/components/ParticleFlowSystem.js
import * as THREE from 'three';
import { PathExtractor } from '../utils/PathExtractor.js';

export class ParticleFlowSystem {
    constructor(scene, components) {
        this.scene = scene;
        this.components = components;
        this.particles = [];
        this.paths = new Map();
        this.isFlowing = false;
        this.flowSpeed = 0.0008; // Slower for better visibility
        this.particleCount = 30; // Fewer particles for better performance
        
        this.initializePaths();
        this.createParticleSystem();
    }
    
    initializePaths() {
        this.paths = PathExtractor.extractPipeCenter(this.components);
    }
    
    createParticleSystem() {
        // Create smaller particle material for internal flow
        this.particleMaterial = new THREE.PointsMaterial({
            color: 0x33bbff,
            size: 0.03, // Smaller size to fit inside pipes
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            alphaTest: 0.1
        });
        
        this.paths.forEach((path, pipeName) => {
            this.createParticlesForPipe(path, pipeName);
        });
    }
    
    createParticlesForPipe(path, pipeName) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = [];
        
        // Initialize particles along the internal path
        for (let i = 0; i < this.particleCount; i++) {
            const t = i / this.particleCount;
            const point = path.getPoint(t);
            
            // Ensure particles start inside the pipe
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;
            
            velocities.push({
                t: t,
                active: false,
                path: path,
                randomOffset: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                }
            });
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particles = new THREE.Points(geometry, this.particleMaterial.clone());
        particles.visible = false;
        
        this.scene.add(particles);
        
        this.particles.push({
            name: pipeName,
            mesh: particles,
            geometry: geometry,
            velocities: velocities,
            activeParticles: 0
        });
    }
    
    startFlow(throttleValue) {
        if (this.isFlowing) return;
        
        this.isFlowing = true;
        this.flowSpeed = Math.max(throttleValue / 100 * 0.003, 0.0005);
        
        this.activateSequentialFlow();
    }
    
    stopFlow() {
        this.isFlowing = false;
        
        this.particles.forEach(particleGroup => {
            particleGroup.mesh.visible = false;
            particleGroup.activeParticles = 0;
            particleGroup.velocities.forEach(vel => vel.active = false);
        });
        
        // Restore pipe opacity
        Object.values(this.components).forEach(pipe => {
            if (pipe && pipe.material) {
                pipe.material.transparent = false;
                pipe.material.opacity = 1.0;
                pipe.material.needsUpdate = true;
            }
        });
    }
    
    activateSequentialFlow() {
        const flowSequence = [
            'Fuel_supply_pipe',
            'Horizontal_Pipe',
            ['Left_Pipe', 'Right_Pipe'],
            'Mid_Pipe',
            'Spool_Pipe'
        ];
        
        let currentIndex = 0;
        
        const activateNext = () => {
            if (!this.isFlowing || currentIndex >= flowSequence.length) return;
            
            const current = flowSequence[currentIndex];
            
            if (Array.isArray(current)) {
                current.forEach(pipeName => {
                    this.activatePipeFlow(pipeName);
                });
            } else {
                this.activatePipeFlow(current);
            }
            
            currentIndex++;
            setTimeout(activateNext, 3000 / Math.max(this.flowSpeed * 1000, 1));
        };
        
        activateNext();
    }
    
    activatePipeFlow(pipeName) {
        const particleGroup = this.particles.find(p => p.name === pipeName);
        if (!particleGroup) return;
        
        // Make pipe transparent
        const pipe = this.components[pipeName];
        if (pipe && pipe.material) {
            pipe.material.transparent = true;
            pipe.material.opacity = 0.2; // More transparent to see particles inside
            pipe.material.needsUpdate = true;
        }
        
        particleGroup.mesh.visible = true;
        
        // Activate particles gradually
        let activationIndex = 0;
        const activateParticle = () => {
            if (!this.isFlowing || activationIndex >= particleGroup.velocities.length) return;
            
            particleGroup.velocities[activationIndex].active = true;
            particleGroup.activeParticles++;
            activationIndex++;
            
            setTimeout(activateParticle, 150); // Slower activation
        };
        
        activateParticle();
    }
    
    update() {
        if (!this.isFlowing) return;
        
        this.particles.forEach(particleGroup => {
            if (!particleGroup.mesh.visible) return;
            
            const positions = particleGroup.geometry.attributes.position.array;
            let updated = false;
            
            particleGroup.velocities.forEach((velocity, index) => {
                if (!velocity.active) return;
                
                velocity.t += this.flowSpeed;
                
                if (velocity.t >= 1.0) {
                    velocity.t = 0.0;
                }
                
                const point = velocity.path.getPoint(velocity.t);
                
                // Apply small random offset to simulate turbulent flow
                positions[index * 3] = point.x + velocity.randomOffset.x;
                positions[index * 3 + 1] = point.y + velocity.randomOffset.y;
                positions[index * 3 + 2] = point.z + velocity.randomOffset.z;
                
                updated = true;
            });
            
            if (updated) {
                particleGroup.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
    
    setFlowSpeed(speed) {
        this.flowSpeed = Math.max(speed, 0.0002);
    }
}
