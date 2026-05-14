# TODO - Persistencia de formularios en Operación

- [x] 1. Implementar persistencia en `sessionStorage` para estados locales de `Operacion` (`tab`, `invLocal`, `rec`, `cor`, `per`, `desc`, `gas`, `guardadoInv`) por `evento.id`.
- [x] 2. Restaurar borrador al montar `Operacion` y fusionar con valores por defecto cuando aplique.
- [ ] 3. Corregir errores actuales en `src/components/Operacion.tsx` (types/lint/estructura) manteniendo persistencia estable.
- [ ] 4. Ejecutar `npm run lint` y confirmar que `Operacion.tsx` quede limpio.
- [ ] 5. Actualizar `TODO.md` con estado final.
