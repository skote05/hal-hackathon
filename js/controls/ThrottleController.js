export class ThrottleController {
    constructor(fuelSystem) {
        this.fuelSystem = fuelSystem;
        this.throttleSlider = null;
        this.throttleValueDisplay = null;
    }

    init() {
        this.throttleSlider = document.getElementById('throttle');
        this.throttleValueDisplay = document.getElementById('throttle-value');

        if (this.throttleSlider) {
            this.throttleSlider.addEventListener('input', (event) => {
                this.handleThrottleChange(event.target.value);
            });
        }
    }

    handleThrottleChange(value) {
        const throttlePercent = parseFloat(value);
        
        // Update fuel system
        this.fuelSystem.setThrottlePosition(throttlePercent);
        
        // Update UI display
        if (this.throttleValueDisplay) {
            this.throttleValueDisplay.textContent = `${throttlePercent}%`;
        }
    }
}
