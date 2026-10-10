import { CustomEase } from 'gsap/CustomEase';
import { client } from './core/client';
import { events } from './core/events';
import { MainController } from './scene/mainController';
import { engine } from './engine/globals';
import { clock } from './engine/clock';
import { UiController } from './components/ui';
import { mountPosterButton } from './engine/photo';
import { mountStreakHud } from './components/streakHud';
import { mountAlbum } from './scene/album';
import { mountGoldenHourHud } from './components/goldenHourHud';
import { mountLightTrailHud } from './components/lightTrailHud';
import { awardPoints, POINTS, readPoints } from './core/adventurePoints';
import { isGoldenHour } from './core/goldenHour';
import { showToast } from './components/toast';
import { assetUrl } from './core/assets';
import './styles.css';

/** Loads the Stylish display font through the app asset base. This works both
 *  in dev (served by the Vite server) and in the static PHP build, where the
 *  CSS-resolved font path would otherwise point to the wrong origin. */
function loadDisplayFont(): void {
  if (!('fonts' in document)) return;
  try {
    const face = new FontFace('Stylish', `url(${assetUrl('assets/fonts/Stylish-Regular.woff2')}) format('woff2')`);
    document.fonts.add(face);
    void face.load().catch(() => {
      // Fall back to sans-serif; the font is decorative only.
    });
  } catch {
    // Fall back to sans-serif; the font is decorative only.
  }
}
loadDisplayFont();

const ui = new UiController(document.getElementById('app') ?? document.body);
mountPosterButton();
mountStreakHud();
mountAlbum();
mountGoldenHourHud();
mountLightTrailHud();

CustomEase.create('inOut1', 'M0,0 C0.5,0 0.1,1 1,1');
CustomEase.create('inOut2', 'M0,0 C0.56,0 0,1 1,1');
CustomEase.create('inOut3', 'M0,0 C0.6,0 0,1 1,1');
CustomEase.create('inOut4', 'M0,0 C0.4,0 -0.06,1 1,1');

function start() {
  if (!client.capabilities.webgl) {
    ui.showUnsupported();
    return;
  }

  const webglContainer = ui.webglContainer;
  const isSafariDesktop = client.browser.name === 'safari' && client.device === 'desktop';
  engine.init({
    webglContainer,
    fingers: 2,
    contextMenu: false,
    DPR: isSafariDesktop ? 1 : Math.min(window.devicePixelRatio, 1.5) || 1,
    adaptiveDPR: true,
  });
  engine.active = true;

  const onEasterEgg = (found: boolean) => ui.incrementEasterEggs(found);
  const onSecret = (message: string) => ui.showSecret(message);
  const onMute = (muted: boolean) => ui.setMuted(muted);
  const onColor = (color: string) => ui.setCharacterColor(color);
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'Escape') ui.closeOverlay();
  };

  // Engagement points: secrets and posters award adventure points, doubled
  // while the daily golden hour is active.
  const onSecretFound = () => {
    const golden = isGoldenHour(new Date());
    const gained = awardPoints(POINTS.secret, golden);
    events.emit('webgl_points_changed', readPoints());
    if (golden) {
      const english = window.GUINOMO_PROFILE?.language === 'en';
      showToast(english ? `✨ +${gained} XP · golden hour` : `✨ +${gained} XP · hora dourada`, 'gold');
    }
  };
  const onPosterCaptured = () => {
    const gained = awardPoints(POINTS.poster, isGoldenHour(new Date()));
    events.emit('webgl_points_changed', readPoints());
    if (gained > 0) showToast(`+${gained} XP`, 'neutral', 3000);
  };

  events.on('webgl_increase_easter_count', onEasterEgg);
  events.on('webgl_show_modal', onSecret);
  events.on('webgl_audio_update_mute', onMute);
  events.on('webgl_character_update_color', onColor);
  events.on('webgl_secret_found', onSecretFound);
  events.on('webgl_poster_captured', onPosterCaptured);
  events.on('keyup', onKeyUp);

  const controller = new MainController();
  if (new URLSearchParams(window.location.search).has('audit')) {
    // Runtime inspection hook for smoke/audit tests. `environment` is private at
    // the type level but present at runtime; the snapshot is intentionally plain
    // JSON so it can cross the Playwright boundary.
    const audit = {
      engine,
      controller,
      ready: controller.ready,
      snapshot: () => {
        const environment = (controller as unknown as { environment?: Record<string, any> }).environment;
        const ids = ['ufo', 'alien', 'cats', 'sloth', 'gossip'] as const;
        const secretVisibility: Record<string, boolean> = {};
        for (const id of ids) {
          const mesh = environment?.[id]?.mesh;
          if (mesh) secretVisibility[id] = Boolean(mesh.visible);
        }
        const params = new URLSearchParams(window.location.search);
        return {
          world: params.get('world') || 'lobby',
          room: params.get('room'),
          secretVisibility,
          secretsVisible: Object.keys(secretVisibility).filter((id) => secretVisibility[id]),
          restAvailable: Boolean(environment?.worldLocations?.restButton),
          skyTheme: environment?.sky?.theme ?? null,
        };
      },
    };
    (window as any).__guinomoAudit = audit;
  }
  const stopClock = clock.start((time, delta) => engine.render(time, delta));

  controller.ready.then(() => {
    ui.showExperience();
    engine.initialSceneLoaded.resolve();
  });

  window.addEventListener(
    'beforeunload',
    () => {
      stopClock();
      events.off('webgl_increase_easter_count', onEasterEgg);
      events.off('webgl_show_modal', onSecret);
      events.off('webgl_audio_update_mute', onMute);
      events.off('webgl_character_update_color', onColor);
      events.off('webgl_secret_found', onSecretFound);
      events.off('webgl_poster_captured', onPosterCaptured);
      events.off('keyup', onKeyUp);
    },
    { once: true },
  );
}

start();
