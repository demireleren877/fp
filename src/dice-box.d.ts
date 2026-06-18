declare module "@3d-dice/dice-box" {
  export interface DiceBoxConfig {
    id?: string;
    container?: string;
    assetPath?: string;
    origin?: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    delay?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    angularDamping?: number;
    linearDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    offscreen?: boolean;
    suspendSimulation?: boolean;
    preloadThemes?: string[];
    externalThemes?: Record<string, string>;
  }

  export interface DieResult {
    value: number;
    groupId: number;
    rollId: number;
    sides: number;
    theme?: string;
    themeColor?: string;
  }

  export default class DiceBox {
    constructor(config?: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string | string[], options?: object): Promise<DieResult[]>;
    add(notation: string | string[], options?: object): Promise<DieResult[]>;
    reroll(rolls: object[], options?: object): Promise<DieResult[]>;
    remove(rolls: object[]): Promise<DieResult[]>;
    clear(): void;
    hide(): DiceBox;
    show(): DiceBox;
    updateConfig(config: DiceBoxConfig): void;
    onRollComplete: (results: DieResult[]) => void;
    onDieComplete: (result: DieResult) => void;
    onRollResult: (result: DieResult) => void;
  }
}
