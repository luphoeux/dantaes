{ pkgs, ... }: {
  # Canal de Nixpkgs a utilizar
  channel = "stable-23.11"; 

  # Paquetes a instalar
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
  ];

  # Variables de entorno
  env = {};

  idx = {
    # Extensiones de VS Code
    extensions = [
      
    ];

    # Configuración del espacio de trabajo
    workspace = {
      onCreate = {
        npm-install = "npm install";
      };
      onStart = {
        # Opcional: comando para iniciar tu servidor si tienes uno
        # run-server = "npm start"; 
      };
    };
  };
}
