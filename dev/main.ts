import '../src/ecosee-card';
import { CARD_TYPE } from '../src/config';
import type { LovelaceCard } from '../src/types/hass';
import { fixtures } from './fixtures';

// Minimal preview harness: a fixture switcher that swaps the hand-built `hass`
// snapshot the card renders against. The stage owns a fixed responsive width, so
// the card scales itself to fit exactly as it does in a dashboard slot.

const stage = document.getElementById('stage') as HTMLDivElement;
const picker = document.getElementById('fixture') as HTMLSelectElement;

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

picker.addEventListener('change', () => applyFixture(Number(picker.value)));

applyFixture(0);
