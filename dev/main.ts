import '../src/ecosee-card';
import { CARD_TYPE } from '../src/config';
import type { LovelaceCard } from '../src/types/hass';
import { fixtures } from './fixtures';

// Minimal preview harness: a fixture switcher and a width slider so the
// responsive squircle can be exercised at different container sizes.

const stage = document.getElementById('stage') as HTMLDivElement;
const picker = document.getElementById('fixture') as HTMLSelectElement;
const widthSlider = document.getElementById('width') as HTMLInputElement;
const widthLabel = document.getElementById('width-label') as HTMLSpanElement;

const card = document.createElement(CARD_TYPE) as LovelaceCard;
stage.appendChild(card);

fixtures.forEach((fixture, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = fixture.label;
  picker.appendChild(option);
});

function applyFixture(index: number): void {
  const fixture = fixtures[index];
  card.setConfig(fixture.config);
  card.hass = fixture.hass;
}

function applyWidth(px: number): void {
  stage.style.width = `${px}px`;
  widthLabel.textContent = `${px}px`;
}

picker.addEventListener('change', () => applyFixture(Number(picker.value)));
widthSlider.addEventListener('input', () => applyWidth(Number(widthSlider.value)));

applyFixture(0);
applyWidth(Number(widthSlider.value));
