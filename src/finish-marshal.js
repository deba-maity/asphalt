import * as THREE from "three";

export function courseFlag(mode, player, phase, elapsed) {
  if (phase === "countdown" || (mode !== "race" && mode !== "sprint" && mode !== "time")) return "furled";
  if (player.finishedAt != null) return "checkered";
  if (phase !== "play") return "furled";
  if (player.next === 0 && (mode !== "race" || player.lap >= 2)) return "checkered";
  if (elapsed < 4 && player.lap === 0) return "green";
  if (mode === "race" && player.next === 0 && player.lap === 1) return "white";
  return "furled";
}

export function makeFinishMarshal(world, model) {
  const rig = new THREE.Group();
  rig.name = "Finish marshal";
  const forward = world.finishForward;
  rig.position.copy(world.finishLine);
  rig.rotation.y = Math.atan2(forward.x, forward.z);
  rig.translateX(13.3);
  rig.translateZ(-1.8);
  world.group.add(rig);

  const steel = world.material({ color: 0x89969b, metalness: .48, roughness: .59 });
  const navy = world.material({ color: 0x263447, roughness: .87 });
  const orange = world.material({ color: 0xe97e32, roughness: .83, emissive: 0x45200a });
  const tape = world.material({ color: 0xf5ebd9, roughness: .55, emissive: 0x29251a });
  const rubber = world.material({ color: 0x202428, roughness: .80 });
  const skin = world.material({ color: 0xb68260, roughness: .82 });
  const sphere = world.trackGeometry(new THREE.SphereGeometry(1, 12, 8));

  const stand = model.assembly(rig, "Timing post");
  stand.box(steel, [0, 1.14, 0], [1.8, .14, 1.6]);
  for (const x of [-.77, .77]) {
    for (const z of [-.65, .65]) stand.bar(steel, [x, 0, z], [x, 1.95, z], .044);
    stand.bar(steel, [x, .1, -.65], [x, 1.10, .65], .038);
  }
  stand.bar(steel, [-.77, 1.95, .65], [.77, 1.95, .65], .042);
  stand.bar(steel, [.77, 1.95, -.65], [.77, 1.95, .65], .042);
  for (const x of [-.15, .15]) {
    stand.bar(navy, [x, 1.30, -.02], [x*.75, 2.02, .01], .105);
    stand.add(sphere, rubber, [x, 1.26, -.06], [.115, .075, .18]);
  }
  stand.add(sphere, orange, [0, 2.25, 0], [.28, .39, .16]);
  stand.add(sphere, tape, [0, 2.20, -.015], [.284, .055, .164]);
  for (const x of [-.13, .13]) {
    stand.bar(tape, [x, 2.24, -.145], [x*.89, 2.52, -.113], .019);
  }
  stand.box(navy, [.13, 2.34, -.16], [.083, .093, .027]);
  stand.bar(navy, [.22, 2.53, 0], [.29, 2.23, -.04], .076);
  stand.bar(orange, [.29, 2.23, -.04], [.18, 2.22, -.18], .07);
  stand.add(sphere, rubber, [.17, 2.22, -.18], [.075,.073,.074]);
  stand.finish();

  const head = model.assembly(rig, "Marshal headset");
  head.group.position.y = 2.75;
  head.add(sphere, skin, [0, .06, -.012], [.15, .18, .14]);
  head.add(sphere, tape, [0, .19, .004], [.17, .088, .16]);
  head.box(tape, [0, .16, -.125], [.28, .033, .15]);
  head.add(sphere, rubber, [0, .085, -.126], [.127, .042, .038]);
  for (const side of [-1, 1]) {
    head.add(sphere, navy, [side*.143, .064, 0], [.043, .070, .058]);
    head.add(sphere, orange, [side*.173, .066, 0], [.022, .051, .046]);
  }
  head.bar(rubber, [.15, .03, -.02], [.078, -.018, -.158], .012);
  head.finish();
  const yaw = rig.rotation.y, sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw);

  const arm = model.assembly(rig, "Flag arm and staff");
  arm.group.position.set(-.22, 2.53, -.03);
  arm.bar(navy, [0, 0, 0], [.02, .26, -.045], .08);
  arm.bar(orange, [.02, .26, -.045], [0, .51, -.14], .066);
  arm.add(sphere, rubber, [0, .51, -.14], [.074, .084, .072]);
  arm.bar(steel, [0, .29, -.14], [0, 1.73, -.14], .025);
  arm.finish();

  const clock = { value: 0 }, checkers = { value: 0 };
  const cloth = world.basic({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  cloth.onBeforeCompile = shader => {
    shader.uniforms.flagClock = clock;
    shader.uniforms.flagCheckers = checkers;
    shader.vertexShader = "uniform float flagClock; varying vec2 flagUV;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", `#include <begin_vertex>
      flagUV = uv;
      float reach = 1.0 - uv.x;
      float phase = flagClock * 7.0 - reach * 8.0 + uv.y * 0.8;
      transformed.z += reach * (0.20 * sin(phase) + 0.075 * sin(phase * 1.65));
      transformed.y -= reach * (0.12 + 0.075 * cos(phase));`);
    shader.fragmentShader = "uniform float flagCheckers; varying vec2 flagUV;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>", `#include <color_fragment>
      float square = mod(floor(flagUV.x * 8.0) + floor(flagUV.y * 5.0), 2.0);
      diffuseColor.rgb *= 1.0 - 0.975 * square * flagCheckers;
      diffuseColor.rgb *= 0.88 + 0.12 * cos((1.0 - flagUV.x) * 6.0 + flagUV.y);`);
  };
  const fabric = new THREE.Mesh(world.trackGeometry(new THREE.PlaneGeometry(1.65, .96, 18, 7)), cloth);
  fabric.name = "Signal flag";
  fabric.position.set(-.825, 1.24, -.14);
  arm.group.add(fabric);
  arm.group.rotation.z = 2.86;
  fabric.visible = false;
  let previous = "furled";
  return {
    rig, arm: arm.group, fabric,
    update(signal, time, dt, focus, distance, animate) {
      rig.visible = !focus || rig.position.distanceToSquared(focus) < Math.min(175, distance) ** 2;
      if (!rig.visible) return;
      if (focus) {
        const x = focus.x - rig.position.x, z = focus.z - rig.position.z;
        const side = x*cosYaw - z*sinYaw, along = x*sinYaw + z*cosYaw;
        const facing = THREE.MathUtils.clamp(Math.atan2(-side, -along), -.92, .92);
        head.group.rotation.y = animate ? THREE.MathUtils.damp(head.group.rotation.y, facing, 6, dt) : 0;
      }
      if (signal !== previous) {
        cloth.color.setHex(signal === "green" ? 0x60ec8f : 0xfff9ed);
        checkers.value = Number(signal === "checkered");
        fabric.visible = signal !== "furled";
        previous = signal;
      }
      const wave = animate ? time : 0;
      const target = fabric.visible ? .68 + .40 * Math.sin(wave * 4.3) : 2.86;
      arm.group.rotation.z = animate ? THREE.MathUtils.damp(arm.group.rotation.z, target, 11, dt) : target;
      clock.value = wave;
    },
  };
}
