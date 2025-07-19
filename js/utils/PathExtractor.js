// js/utils/PathExtractor.js
import * as THREE from 'three';

export class PathExtractor {
    static extractPipeCenter(pipeGroup) {
        const paths = new Map();
        
        const pipeFlow = [
            'Fuel_supply_pipe',
            'Horizontal_Pipe', 
            ['Left_Pipe', 'Right_Pipe'],
            'Mid_Pipe',
            'Spool_Pipe'
        ];
        
        pipeFlow.forEach((pipeNames, index) => {
            if (Array.isArray(pipeNames)) {
                pipeNames.forEach(pipeName => {
                    const pipe = pipeGroup[pipeName];
                    if (pipe) {
                        paths.set(pipeName, this.calculateInternalPath(pipe, pipeName));
                    }
                });
            } else {
                const pipe = pipeGroup[pipeNames];
                if (pipe) {
                    paths.set(pipeNames, this.calculateInternalPath(pipe, pipeNames));
                }
            }
        });
        
        return paths;
    }
    
    static calculateInternalPath(pipeMesh, pipeName) {
        const box = new THREE.Box3().setFromObject(pipeMesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate internal dimensions (assuming pipe walls have thickness)
        const wallThickness = 0.1; // Adjust based on your model
        const internalSize = new THREE.Vector3(
            Math.max(size.x - wallThickness * 2, size.x * 0.6),
            Math.max(size.y - wallThickness * 2, size.y * 0.6),
            Math.max(size.z - wallThickness * 2, size.z * 0.6)
        );
        
        const points = [];
        const segments = 30; // More segments for smoother flow
        
        // Determine flow direction based on pipe name and dimensions
        let flowDirection = this.determineFlowDirection(pipeName, size);
        
        // Generate internal path points
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = center.clone();
            
            // Apply offset for internal positioning
            switch (flowDirection) {
                case 'x':
                    point.x = box.min.x + wallThickness + internalSize.x * t;
                    // Add slight randomization to avoid perfect centerline
                    point.y += (Math.random() - 0.5) * internalSize.y * 0.2;
                    point.z += (Math.random() - 0.5) * internalSize.z * 0.2;
                    break;
                case 'y':
                    point.y = box.min.y + wallThickness + internalSize.y * t;
                    point.x += (Math.random() - 0.5) * internalSize.x * 0.2;
                    point.z += (Math.random() - 0.5) * internalSize.z * 0.2;
                    break;
                case 'z':
                    point.z = box.min.z + wallThickness + internalSize.z * t;
                    point.x += (Math.random() - 0.5) * internalSize.x * 0.2;
                    point.y += (Math.random() - 0.5) * internalSize.y * 0.2;
                    break;
            }
            
            points.push(point);
        }
        
        return new THREE.CatmullRomCurve3(points);
    }
    
    static determineFlowDirection(pipeName, size) {
        // Determine main flow direction based on pipe name and dimensions
        if (pipeName.includes('Horizontal')) {
            return size.x > size.z ? 'x' : 'z';
        } else if (pipeName.includes('Left_Pipe') || pipeName.includes('Right_Pipe')) {
            return 'y'; // Usually vertical flow
        } else if (pipeName.includes('Mid_Pipe')) {
            return 'y'; // Downward flow
        } else if (pipeName.includes('supply')) {
            return size.y > size.x ? 'y' : (size.x > size.z ? 'x' : 'z');
        }
        
        // Default: use longest dimension
        if (size.y > size.x && size.y > size.z) return 'y';
        else if (size.z > size.x && size.z > size.y) return 'z';
        else return 'x';
    }
}
