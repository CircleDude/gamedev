import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { SkinOverlayScene } from './SkinOverlayScene';
import { SettingsOverlayScene } from './SettingsOverlayScene';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY_Y } from './constants';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0f172a',
    // Первая в массиве сцена стартует автоматически — это MenuScene.
    // Оверлеи идут последними — рендерятся поверх всех остальных сцен.
    scene: [MenuScene, GameScene, LevelSelectScene, SkinOverlayScene, SettingsOverlayScene],
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: GRAVITY_Y },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
