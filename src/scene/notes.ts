// Notes in the world: terrain-anchored messages, persisted per world via PHP.
//
// GET  api/guinomo/notes.php?world=<id>
// POST api/guinomo/notes.php  { world, x, y, z, text }
//
// Markers reuse the same terrain raycast as worldLocations: a note is placed on
// the ground at its stored XZ with a billboard sprite. The contextual "read"
// action appears when the player stands within NEAR_DISTANCE of a marker.

import { CanvasTexture, Raycaster, Sprite, SpriteMaterial, Vector3 } from 'three';
import { appEndpointUrl } from '../core/assets';
import { getWorldId, type WorldId } from '../core/worlds';
import { SceneModule } from './SceneModule';
import './notes.css';

interface WorldNote {
  id: number;
  text: string;
  x: number;
  y: number;
  z: number;
  uid: number;
  createdAt: number;
}

/** Proximity (metres, XZ plane) under which the read action appears. */
const NEAR_DISTANCE = 3;
const MAX_NOTE_LENGTH = 200;

function isWorldNote(value: unknown): value is WorldNote {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'number' &&
    typeof note.text === 'string' &&
    typeof note.x === 'number' &&
    Number.isFinite(note.x) &&
    typeof note.y === 'number' &&
    Number.isFinite(note.y) &&
    typeof note.z === 'number' &&
    Number.isFinite(note.z) &&
    typeof note.uid === 'number' &&
    typeof note.createdAt === 'number'
  );
}

function isNotesPayload(value: unknown): value is { success: true; notes: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return payload.success === true && Array.isArray(payload.notes);
}

function isAddPayload(value: unknown): value is { success: true; id: number } {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return payload.success === true && typeof payload.id === 'number';
}

function isOkPayload(value: unknown): value is { success: true } {
  if (typeof value !== 'object' || value === null) return false;
  return (value as Record<string, unknown>).success === true;
}

function payloadError(value: unknown): string | null {
  if (typeof value === 'object' && value !== null) {
    const error = (value as Record<string, unknown>).error;
    if (typeof error === 'string' && error !== '') return error;
  }
  return null;
}

export class Notes extends SceneModule {
  declare private worldId: WorldId;
  declare private raycaster: Raycaster;
  declare private down: Vector3;
  declare private markerTexture: CanvasTexture | null;

  private notes: WorldNote[] = [];
  private markers = new Map<number, Sprite>();
  private editingId: number | null = null;
  private near: WorldNote | null = null;
  private panel: HTMLDivElement | null = null;
  private panelBody: HTMLDivElement | null = null;
  private action: HTMLButtonElement | null = null;
  private compose: HTMLButtonElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private status: HTMLParagraphElement | null = null;

  protected async init() {
    this.worldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
    this.raycaster = new Raycaster();
    this.down = new Vector3(0, -1, 0);
    this.markerTexture = null;

    this.setupUi();
    this.scene.beforeRenderCbs.push(this.updateAction);

    try {
      await this.load();
    } catch (error) {
      // The world simply shows no notes; a failed endpoint is not fatal.
      console.warn('Unable to load the world notes:', error);
    }

    try {
      await this.scene.terrain.ready;
      this.scene.terrain.mesh.updateMatrixWorld(true);
      for (const note of this.notes) this.addMarker(note);
    } catch (error) {
      console.warn('Unable to anchor the world notes:', error);
    }

    this.ready.resolve();
  }

  private async load(): Promise<void> {
    const endpoint = appEndpointUrl(`api/guinomo/notes.php?world=${encodeURIComponent(this.worldId)}`);
    const response = await fetch(endpoint, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return;

    const payload: unknown = await response.json();
    if (!isNotesPayload(payload)) return;
    this.notes = payload.notes.filter(isWorldNote);
  }

  private setupUi(): void {
    this.action = this.createButton('notes-action', () => {
      if (this.near) this.openReader(this.near);
    });
    this.action.hidden = true;

    this.compose = this.createButton('notes-compose', () => this.openCompose());
    this.compose.textContent = this.text('Leave a note', 'Deixar recado');
    this.compose.setAttribute('aria-label', this.compose.textContent);

    const panel = document.createElement('div');
    panel.id = 'notes-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.hidden = true;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notes-close';
    close.textContent = '×';
    close.setAttribute('aria-label', this.text('Close', 'Fechar'));
    close.addEventListener('click', () => this.closePanel());

    const body = document.createElement('div');
    body.className = 'notes-body';

    panel.append(close, body);
    document.body.append(panel);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closePanel();
    });

    this.panel = panel;
    this.panelBody = body;
  }

  private createButton(id: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = id;
    button.className = id;
    button.type = 'button';
    button.addEventListener('click', onClick);
    document.body.append(button);
    return button;
  }

  private isOwn(note: WorldNote): boolean {
    return note.uid > 0 && note.uid === (window.GUINOMO_UID ?? 0);
  }

  private openReader(note: WorldNote): void {
    const body = this.panelBody;
    if (!body) return;
    body.replaceChildren();

    const author = document.createElement('p');
    author.className = 'notes-author';
    author.textContent = this.authorLabel(note);

    const text = document.createElement('p');
    text.className = 'notes-text';
    text.textContent = note.text;

    body.append(author, text);

    if (this.isOwn(note)) {
      const actions = document.createElement('div');
      actions.className = 'notes-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'notes-action-button';
      edit.textContent = this.text('Edit', 'Editar');
      edit.addEventListener('click', () => this.openCompose(note));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'notes-action-button notes-action-danger';
      remove.textContent = this.text('Delete', 'Apagar');
      remove.addEventListener('click', () => this.openDelete(note));

      actions.append(edit, remove);
      body.append(actions);
    }

    const compose = document.createElement('button');
    compose.type = 'button';
    compose.className = 'notes-submit';
    compose.textContent = this.text('Leave a note', 'Deixar recado');
    compose.addEventListener('click', () => this.openCompose());

    body.append(compose);
    this.input = null;
    this.submitButton = null;
    this.status = null;
    this.editingId = null;
    this.openPanel();
  }

  private openCompose(note?: WorldNote): void {
    const body = this.panelBody;
    if (!body) return;
    body.replaceChildren();

    const title = document.createElement('p');
    title.className = 'notes-author';
    title.textContent = note
      ? this.text('Edit note', 'Editar recado')
      : this.text('Leave a note', 'Deixar recado');

    const input = document.createElement('textarea');
    input.className = 'notes-input';
    input.maxLength = MAX_NOTE_LENGTH;
    input.rows = 4;
    input.placeholder = this.text(
      'Write something (max 200 characters)…',
      'Escreve algo (máx. 200 caracteres)…',
    );
    if (note) input.value = note.text;

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'notes-submit';
    submit.textContent = note
      ? this.text('Save changes', 'Guardar alterações')
      : this.text('Place note', 'Colocar recado');

    const status = document.createElement('p');
    status.className = 'notes-status';
    status.setAttribute('role', 'status');

    body.append(title, input, submit, status);
    this.input = input;
    this.submitButton = submit;
    this.status = status;
    this.editingId = note ? note.id : null;

    input.addEventListener('input', () => this.updateSubmitState());
    submit.addEventListener('click', () => void this.submit());
    this.updateSubmitState();
    this.openPanel();
    input.focus();
  }

  private updateSubmitState(): void {
    const input = this.input;
    const submit = this.submitButton;
    if (!input || !submit) return;
    const length = input.value.trim().length;
    submit.disabled = length === 0 || input.value.length > MAX_NOTE_LENGTH;
  }

  private async submit(): Promise<void> {
    const input = this.input;
    const submit = this.submitButton;
    const status = this.status;
    if (!input || !submit || !status) return;

    const text = input.value.trim();
    if (text.length === 0 || text.length > MAX_NOTE_LENGTH) {
      this.setStatus(
        status,
        this.text('Write between 1 and 200 characters.', 'Escreve entre 1 e 200 caracteres.'),
        'error',
      );
      return;
    }

    const editing = this.editingId;
    submit.disabled = true;
    this.setStatus(
      status,
      editing !== null ? this.text('Saving…', 'A guardar…') : this.text('Sending…', 'A enviar…'),
      'pending',
    );

    if (editing !== null) {
      const body = new URLSearchParams({
        action: 'update',
        id: String(editing),
        world: this.worldId,
        text,
        csrf_token: window.CSRF_TOKEN || '',
      });

      try {
        const response = await fetch(appEndpointUrl('api/guinomo/notes.php'), {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
        });
        const payload: unknown = await response.json();

        if (response.ok && isOkPayload(payload)) {
          const existing = this.notes.find((note) => note.id === editing);
          if (existing) existing.text = text;
          this.editingId = null;
          this.openReader(existing ?? this.localNote(editing, text));
          return;
        }

        this.setStatus(
          status,
          payloadError(payload) ?? this.text('Unable to save the note.', 'Não foi possível guardar o recado.'),
          'error',
        );
      } catch (error) {
        console.warn('Unable to save the world note:', error);
        this.setStatus(
          status,
          this.text('Unable to reach the server.', 'Não foi possível contactar o servidor.'),
          'error',
        );
      } finally {
        submit.disabled = false;
      }
      return;
    }

    const local = this.scene.characters?.mesh?._localObject;
    if (!local) {
      this.setStatus(
        status,
        this.text('Cannot find your position.', 'Não foi possível encontrar a tua posição.'),
        'error',
      );
      return;
    }

    const { x, y, z } = local.position;

    const body = new URLSearchParams({
      world: this.worldId,
      x: String(x),
      y: String(y),
      z: String(z),
      text,
      csrf_token: window.CSRF_TOKEN || '',
    });

    try {
      const response = await fetch(appEndpointUrl('api/guinomo/notes.php'), {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      const payload: unknown = await response.json();

      if (response.ok && isAddPayload(payload)) {
        const note: WorldNote = {
          id: payload.id,
          text,
          x,
          y,
          z,
          uid: window.GUINOMO_UID ?? 0,
          createdAt: Math.floor(Date.now() / 1000),
        };
        this.notes.push(note);
        this.addMarker(note);
        this.openReader(note);
        return;
      }

      this.setStatus(
        status,
        payloadError(payload) ?? this.text('Unable to save the note.', 'Não foi possível guardar o recado.'),
        'error',
      );
    } catch (error) {
      console.warn('Unable to save the world note:', error);
      this.setStatus(
        status,
        this.text('Unable to reach the server.', 'Não foi possível contactar o servidor.'),
        'error',
      );
    } finally {
      submit.disabled = false;
    }
  }

  /** Local fallback shape for a freshly updated note whose copy is missing. */
  private localNote(id: number, text: string): WorldNote {
    return { id, text, x: 0, y: 0, z: 0, uid: window.GUINOMO_UID ?? 0, createdAt: 0 };
  }

  private openDelete(note: WorldNote): void {
    const body = this.panelBody;
    if (!body) return;
    body.replaceChildren();

    const title = document.createElement('p');
    title.className = 'notes-author';
    title.textContent = this.text('Delete this note?', 'Apagar este recado?');

    const preview = document.createElement('p');
    preview.className = 'notes-text';
    preview.textContent = note.text;

    const actions = document.createElement('div');
    actions.className = 'notes-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'notes-action-button';
    cancel.textContent = this.text('Cancel', 'Cancelar');
    cancel.addEventListener('click', () => this.openReader(note));

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'notes-action-button notes-action-danger';
    confirm.textContent = this.text('Delete', 'Apagar');

    const status = document.createElement('p');
    status.className = 'notes-status';
    status.setAttribute('role', 'status');

    confirm.addEventListener('click', () => void this.deleteNote(note, confirm, status));

    actions.append(cancel, confirm);
    body.append(title, preview, actions, status);
    this.input = null;
    this.submitButton = null;
    this.status = status;
    this.editingId = null;
    this.openPanel();
  }

  private async deleteNote(note: WorldNote, confirm: HTMLButtonElement, status: HTMLParagraphElement): Promise<void> {
    confirm.disabled = true;
    this.setStatus(status, this.text('Deleting…', 'A apagar…'), 'pending');

    const body = new URLSearchParams({
      action: 'delete',
      id: String(note.id),
      world: this.worldId,
      csrf_token: window.CSRF_TOKEN || '',
    });

    try {
      const response = await fetch(appEndpointUrl('api/guinomo/notes.php'), {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      const payload: unknown = await response.json();

      if (response.ok && isOkPayload(payload)) {
        this.removeLocal(note.id);
        this.closePanel();
        return;
      }

      if (response.status === 404) {
        // The note is already gone; drop it locally and move on.
        this.removeLocal(note.id);
        this.closePanel();
        return;
      }

      this.setStatus(
        status,
        payloadError(payload) ?? this.text('Unable to delete the note.', 'Não foi possível apagar o recado.'),
        'error',
      );
      confirm.disabled = false;
    } catch (error) {
      console.warn('Unable to delete the world note:', error);
      this.setStatus(
        status,
        this.text('Unable to reach the server.', 'Não foi possível contactar o servidor.'),
        'error',
      );
      confirm.disabled = false;
    }
  }

  private removeLocal(id: number): void {
    this.notes = this.notes.filter((note) => note.id !== id);
    this.markers.get(id)?.remove();
    this.markers.delete(id);
    if (this.near?.id === id) this.near = null;
  }

  private setStatus(status: HTMLParagraphElement, message: string, state: string): void {
    status.textContent = message;
    status.dataset.state = state;
  }

  private openPanel(): void {
    if (this.panel) this.panel.hidden = false;
    if (this.action) this.action.hidden = true;
  }

  private closePanel(): void {
    if (this.panel) this.panel.hidden = true;
  }

  private updateAction = () => {
    const action = this.action;
    const local = this.scene.characters?.mesh?._localObject;
    if (!action || !local) return;

    let nearest: WorldNote | null = null;
    let nearestDistance = NEAR_DISTANCE;
    for (const note of this.notes) {
      const distance = Math.hypot(local.position.x - note.x, local.position.z - note.z);
      if (distance < nearestDistance) {
        nearest = note;
        nearestDistance = distance;
      }
    }
    this.near = nearest;

    const panelClosed = this.panel ? this.panel.hidden : true;
    const visible = nearest !== null && panelClosed;
    action.hidden = !visible;
    if (!visible) return;

    const label = this.text('Read note', 'Ler recado');
    if (action.textContent !== label) action.textContent = label;
    action.setAttribute('aria-label', label);
  };

  private addMarker(note: WorldNote): void {
    if (!this.markerTexture) this.markerTexture = this.createMarkerTexture();

    const sprite = new Sprite(
      new SpriteMaterial({
        map: this.markerTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sprite.scale.setScalar(1.1);
    sprite.position.set(note.x, this.groundAt(note.x, note.z) + 1.05, note.z);
    sprite.userData.noteId = note.id;
    this.scene.add(sprite);
    this.markers.set(note.id, sprite);
  }

  /** Reuses worldLocations' ground raycast against scene.terrain.mesh. */
  private groundAt(x: number, z: number): number {
    this.raycaster.set(new Vector3(x, 50, z), this.down);
    const hit = this.raycaster.intersectObject(this.scene.terrain.mesh, false)[0];
    return hit?.point.y ?? 0;
  }

  private createMarkerTexture(): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is required to render world notes.');

    const rounded = (x: number, y: number, w: number, h: number, r: number): void => {
      context.beginPath();
      context.moveTo(x + r, y);
      context.lineTo(x + w - r, y);
      context.quadraticCurveTo(x + w, y, x + w, y + r);
      context.lineTo(x + w, y + h - r);
      context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      context.lineTo(x + r, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - r);
      context.lineTo(x, y + r);
      context.quadraticCurveTo(x, y, x + r, y);
      context.closePath();
    };

    // Tail first so the card sits over its seam.
    context.fillStyle = '#fff7e6';
    context.beginPath();
    context.moveTo(52, 86);
    context.lineTo(64, 110);
    context.lineTo(76, 86);
    context.closePath();
    context.fill();

    context.fillStyle = 'rgba(20, 28, 32, 0.3)';
    rounded(17, 18, 96, 74, 16);
    context.fill();

    context.fillStyle = '#fff7e6';
    context.strokeStyle = '#5a5248';
    context.lineWidth = 5;
    rounded(15, 14, 96, 74, 16);
    context.fill();
    context.stroke();

    context.strokeStyle = '#b7a888';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(32, 40);
    context.lineTo(94, 40);
    context.moveTo(32, 56);
    context.lineTo(94, 56);
    context.moveTo(32, 72);
    context.lineTo(72, 72);
    context.stroke();

    return new CanvasTexture(canvas);
  }

  private authorLabel(note: WorldNote): string {
    if (this.isOwn(note)) return this.text('Your note', 'O teu recado');
    const name = note.uid > 0 ? `#${note.uid}` : this.text('Anonymous', 'Anónimo');
    return this.text(`Note from ${name}`, `Recado de ${name}`);
  }

  private text(en: string, pt: string): string {
    const language = window.GUINOMO_PROFILE?.language || document.documentElement.lang.slice(0, 2);
    return language === 'en' ? en : pt;
  }
}
